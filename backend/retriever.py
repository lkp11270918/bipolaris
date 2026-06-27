from __future__ import annotations

import json
import math
import re
import sqlite3
from collections import Counter
from typing import Any

from .rag_knowledge import CURATED_RAG_DOCS
from .rag_store import RagDocument, RagStore
from .settings import DB_PATH, OPENAI_EMBEDDING_MODEL, PROCESSED_DIR

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None  # type: ignore[assignment]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


class LocalRetriever:
    def __init__(self, api_key: str | None, db_path=DB_PATH, embedding_model: str = OPENAI_EMBEDDING_MODEL) -> None:
        self.api_key = api_key
        self.embedding_model = embedding_model
        self.store = RagStore(db_path)
        self._docs: list[RagDocument] | None = None
        self._lexical_docs: list[dict[str, Any]] | None = None
        self._client = OpenAI(api_key=api_key) if (api_key and OpenAI is not None) else None

    def _load_docs(self) -> list[RagDocument]:
        if self._docs is None:
            try:
                self._docs = [doc for doc in self.store.load_documents() if doc.embedding]
            except sqlite3.Error:
                self._docs = []
        return self._docs

    def refresh(self) -> None:
        self._docs = None
        self._lexical_docs = None

    def is_ready(self) -> bool:
        return bool(self._load_docs() or self._load_lexical_docs())

    def count_documents(self) -> int:
        vector_count = len(self._load_docs())
        return vector_count if vector_count else len(self._load_lexical_docs())

    def _load_lexical_docs(self) -> list[dict[str, Any]]:
        if self._lexical_docs is not None:
            return self._lexical_docs

        path = PROCESSED_DIR / "corpus.jsonl"
        self._lexical_docs = [dict(doc) for doc in CURATED_RAG_DOCS]
        if not path.exists():
            return self._lexical_docs

        seen_ids = {doc.get("doc_id") for doc in self._lexical_docs}
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    doc = json.loads(line)
                    if doc.get("doc_id") not in seen_ids:
                        self._lexical_docs.append(doc)
                except json.JSONDecodeError:
                    continue
        return self._lexical_docs

    def embed_query(self, text: str) -> list[float]:
        if self._client is None:
            return []
        try:
            response = self._client.embeddings.create(model=self.embedding_model, input=text)
            return list(response.data[0].embedding)
        except Exception:
            return []

    def search(
        self,
        query: str,
        top_k: int = 4,
        min_score: float = 0.18,
        bd_state: str | None = None,
        risk_level: str | None = None,
    ) -> list[dict[str, Any]]:
        context = self._infer_query_context(query, bd_state=bd_state, risk_level=risk_level)
        query_embedding = self.embed_query(query)
        if not query_embedding:
            return self._lexical_search(query, top_k=top_k, context=context)

        scored: list[tuple[float, float, RagDocument]] = []
        for doc in self._load_docs():
            assert doc.embedding is not None
            base_score = cosine_similarity(query_embedding, doc.embedding)
            final_score = self._rerank_score(base_score, doc.metadata, context)
            if base_score >= min_score or final_score >= min_score:
                scored.append((final_score, base_score, doc))
        scored.sort(key=lambda item: item[0], reverse=True)

        results: list[dict[str, Any]] = []
        for score, base_score, doc in scored[:top_k]:
            results.append(
                {
                    "source": doc.source,
                    "score": round(score, 4),
                    "base_score": round(base_score, 4),
                    "summary": doc.text,
                    "strategy": doc.metadata.get("strategy"),
                    "metadata": {**doc.metadata, "retrieval_mode": "vector_rerank", "query_context": context},
                }
            )
        return results or self._lexical_search(query, top_k=top_k, context=context)

    def _infer_query_context(
        self, query: str, bd_state: str | None = None, risk_level: str | None = None
    ) -> dict[str, str]:
        lowered = query.lower()
        topic = "general_support"
        if any(term in lowered for term in ["复诊", "医生", "报告", "摘要"]):
            topic = "followup_summary"
        elif any(term in lowered for term in ["停药", "加药", "减药", "补服", "副作用", "药", "medication", "dose"]):
            topic = "medication_boundary"
        elif any(term in lowered for term in ["睡", "失眠", "不困", "insomnia", "sleep"]):
            topic = "sleep"
        elif any(term in lowered for term in ["冲动", "花钱", "冒险", "砸东西", "impulsive"]):
            topic = "impulsivity"
        elif any(term in lowered for term in ["工作", "压力", "job", "work"]):
            topic = "work_stress"
        elif any(term in lowered for term in ["感情", "关系", "伴侣", "家人", "relationship"]):
            topic = "relationship"

        inferred_risk = risk_level or "low"
        if any(term in lowered for term in ["自杀", "轻生", "不想活", "活着没意义", "结束这一切", "自残", "吞药", "过量"]):
            inferred_risk = "crisis"
        elif any(term in lowered for term in ["崩溃", "受不了", "控制不住", "失控", "砸东西"]):
            inferred_risk = "medium"

        inferred_state = bd_state or "stable"
        if inferred_state == "stable":
            if any(term in lowered for term in ["睡不着", "不需要睡", "精力", "停不下来", "脑子很快", "冲动", "躁"]):
                inferred_state = "manic"
            if any(term in lowered for term in ["低落", "无望", "没意义", "没动力", "崩溃", "绝望"]):
                inferred_state = "mixed" if inferred_state == "manic" else "depressed"

        return {"topic": topic, "risk_level": inferred_risk, "bd_state": inferred_state}

    def _rerank_score(self, base_score: float, metadata: dict[str, Any], context: dict[str, str]) -> float:
        score = base_score
        doc_type = str(metadata.get("doc_type") or "")
        doc_risk = str(metadata.get("risk_level") or "low")
        doc_state = str(metadata.get("bd_state") or "stable")
        doc_topic = str(metadata.get("topic") or "")

        if doc_type in {"safety_rule", "medical_boundary", "clinical_knowledge", "product_knowledge"}:
            score += 0.08
        if doc_risk == context["risk_level"]:
            score += 0.12
        elif doc_risk == "crisis" and context["risk_level"] != "crisis":
            score -= 0.12
        if doc_state in {context["bd_state"], "any"}:
            score += 0.08
        if doc_topic == context["topic"]:
            score += 0.22
        if context["topic"] == "medication_boundary" and doc_type == "medical_boundary":
            score += 0.18
        if context["topic"] == "followup_summary" and doc_type == "product_knowledge":
            score += 0.18
        if context["risk_level"] == "crisis" and doc_type == "safety_rule":
            score += 0.2
        if context["bd_state"] in {"manic", "mixed"} and doc_topic in {"manic_warning_signs", "mixed_state_support"}:
            score += 0.1
        if context["bd_state"] == "manic" and context["topic"] == "sleep" and doc_topic == "manic_warning_signs":
            score += 0.12
        return max(0.0, score)

    def _query_terms(self, query: str) -> list[str]:
        lowered = query.lower()
        terms = re.findall(r"[a-z0-9]+", lowered)
        term_map = {
            "工作": ["job", "work", "career"],
            "压力": ["pressure", "stress", "stressed"],
            "焦虑": ["anxiety", "anxious"],
            "低落": ["depress", "sad", "down"],
            "无望": ["hopeless", "point"],
            "孤独": ["alone", "lonely"],
            "睡": ["sleep", "insomnia", "night"],
            "失眠": ["sleep", "insomnia"],
            "精力": ["energy", "energetic"],
            "停不下来": ["racing", "manic", "antsy"],
            "脑子": ["brain", "thoughts", "racing"],
            "冲动": ["impulsive", "impulsivity", "urge"],
            "花钱": ["spending", "shopping", "buy"],
            "冒险": ["risk", "risky"],
            "烦躁": ["agitated", "irritable", "angry"],
            "砸东西": ["break", "breaking", "snap"],
            "药": ["medication", "meds", "lamictal", "lithium"],
            "服药": ["medication", "meds"],
            "停药": ["stop taking", "dose", "withdrawal"],
            "副作用": ["side effect", "sedation", "nauseous"],
            "医生": ["doctor", "psychiatrist", "therapist"],
            "复诊": ["follow-up", "appointment", "doctor", "psychiatrist", "summary"],
            "报告": ["report", "summary", "doctor", "follow-up"],
            "摘要": ["summary", "report", "follow-up"],
        }
        for chinese_term, expansions in term_map.items():
            if chinese_term in lowered:
                terms.append(chinese_term)
                terms.extend(expansions)
        if len(lowered) <= 24:
            terms.extend(lowered[index : index + 2] for index in range(max(0, len(lowered) - 1)))
        return [term for term in terms if term.strip()]

    def _lexical_search(
        self, query: str, top_k: int = 4, context: dict[str, str] | None = None
    ) -> list[dict[str, Any]]:
        docs = self._load_lexical_docs()
        if not docs:
            return []
        context = context or self._infer_query_context(query)

        query_terms = self._query_terms(query)
        if not query_terms:
            return []

        scored: list[tuple[float, dict[str, Any]]] = []
        for doc in docs:
            searchable = f"{doc.get('retrieval_text', '')}\n{doc.get('text', '')}".lower()
            matches = sum(1 for term in query_terms if term in searchable)
            if not matches:
                continue
            score = matches / max(len(set(query_terms)), 1)
            score = self._rerank_score(score, doc.get("metadata") or {}, context)
            scored.append((score, doc))

        scored.sort(key=lambda item: item[0], reverse=True)
        results: list[dict[str, Any]] = []
        for score, doc in scored[:top_k]:
            metadata = doc.get("metadata") or {}
            results.append(
                {
                    "source": doc.get("source"),
                    "score": round(min(score, 1.0), 4),
                    "summary": doc.get("text"),
                    "strategy": metadata.get("strategy"),
                    "metadata": {**metadata, "retrieval_mode": "lexical_rerank", "query_context": context},
                }
            )
        return results

    def infer_strategy(self, results: list[dict[str, Any]]) -> str | None:
        strategies = [item.get("strategy") for item in results if item.get("strategy")]
        if not strategies:
            return None
        return Counter(strategies).most_common(1)[0][0]
