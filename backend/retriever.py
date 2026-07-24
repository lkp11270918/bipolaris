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


def normalize_evidence_metadata(source: str, metadata: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(metadata)
    dataset = str(normalized.get("dataset") or source)
    doc_type = str(normalized.get("doc_type") or "")
    if "authority_level" not in normalized:
        if doc_type in {"official_guideline", "official_patient_education"}:
            normalized["authority_level"] = "A"
        elif doc_type in {"safety_rule", "medical_boundary", "clinical_knowledge", "support_strategy"} or dataset == "thu-coai/esconv":
            normalized["authority_level"] = "B"
        else:
            normalized["authority_level"] = "C"
    if "evidence_type" not in normalized:
        if doc_type in {"official_guideline", "official_patient_education", "clinical_knowledge"}:
            normalized["evidence_type"] = "clinical_knowledge"
        elif doc_type in {"safety_rule", "medical_boundary", "support_strategy"}:
            normalized["evidence_type"] = "support_policy"
        elif dataset == "thu-coai/esconv":
            normalized["evidence_type"] = "conversation_example"
        else:
            normalized["evidence_type"] = "lived_experience"
    normalized.setdefault("medical_fact_allowed", normalized.get("authority_level") == "A")
    normalized.setdefault("source_title", source)
    normalized.setdefault("published_at", "")
    normalized.setdefault("reviewed_at", "")
    return normalized


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
        topic: str | None = None,
        medical_fact_required: bool = False,
        allowed_authority_levels: set[str] | None = None,
        region: str = "CN",
    ) -> list[dict[str, Any]]:
        context = self._infer_query_context(query, bd_state=bd_state, risk_level=risk_level)
        if topic:
            context["topic"] = topic
        context["region"] = region
        context["medical_fact_required"] = "true" if medical_fact_required else "false"
        context["allowed_authority_levels"] = ",".join(sorted(allowed_authority_levels or set()))
        candidate_k = max(top_k * 5, 20)
        vector_results = self._vector_search(query, top_k=candidate_k, min_score=min_score, context=context)
        lexical_groups = [
            self._lexical_search(variant, top_k=candidate_k, context=context)
            for variant in self._rewrite_queries(query, context)
        ]
        lexical_results = self._merge_ranked_lists(lexical_groups, candidate_k)
        fused = self._fuse_results(vector_results, lexical_results, top_k=candidate_k, context=context)
        candidates = fused or lexical_results
        return self._second_stage_rerank(query, candidates, context, top_k)

    def _eligible(self, metadata: dict[str, Any], context: dict[str, str]) -> bool:
        authority = str(metadata.get("authority_level") or "C")
        if context.get("medical_fact_required") == "true" and not bool(metadata.get("medical_fact_allowed")):
            return False
        allowed = {item for item in context.get("allowed_authority_levels", "").split(",") if item}
        if allowed and authority not in allowed:
            return False
        region = str(metadata.get("region") or "")
        requested_region = context.get("region")
        return not region or region in {requested_region, "international"}

    def _vector_search(
        self, query: str, top_k: int, min_score: float, context: dict[str, str]
    ) -> list[dict[str, Any]]:
        query_embedding = self.embed_query(query)
        if not query_embedding:
            return []

        scored: list[tuple[float, float, RagDocument]] = []
        for doc in self._load_docs():
            assert doc.embedding is not None
            doc.metadata = normalize_evidence_metadata(doc.source, doc.metadata)
            if not self._eligible(doc.metadata, context):
                continue
            base_score = cosine_similarity(query_embedding, doc.embedding)
            final_score = self._rerank_score(base_score, doc.metadata, context)
            if base_score >= min_score or final_score >= min_score:
                scored.append((final_score, base_score, doc))
        scored.sort(key=lambda item: item[0], reverse=True)

        results: list[dict[str, Any]] = []
        for score, base_score, doc in scored[:top_k]:
            results.append(
                {
                    "doc_id": doc.doc_id,
                    "source": doc.source,
                    "score": round(score, 4),
                    "base_score": round(base_score, 4),
                    "summary": doc.text,
                    "strategy": doc.metadata.get("strategy"),
                    "metadata": {**doc.metadata, "retrieval_mode": "vector_rerank", "query_context": context},
                }
            )
        return results

    def _infer_query_context(
        self, query: str, bd_state: str | None = None, risk_level: str | None = None
    ) -> dict[str, str]:
        lowered = query.lower()
        topic = "general_support"
        if any(term in lowered for term in ["复诊", "医生", "报告", "摘要"]):
            topic = "followup_summary"
        elif any(term in lowered for term in ["停药", "加药", "减药", "补服", "副作用", "药", "medication", "dose"]):
            topic = "medication_boundary"
        elif any(term in lowered for term in ["睡", "失眠", "不困", "通宵", "没睡", "insomnia", "sleep"]):
            topic = "sleep"
        elif any(term in lowered for term in ["冲动", "花钱", "冒险", "砸东西", "辞职", "开快车", "借钱", "重大决定", "impulsive"]):
            topic = "impulsivity"
        elif any(term in lowered for term in ["工作", "压力", "job", "work"]):
            topic = "work_stress"
        elif any(term in lowered for term in ["感情", "关系", "伴侣", "家人", "relationship"]):
            topic = "relationship"
        elif any(term in lowered for term in ["复发", "维持期", "预警", "长期状态", "再次发作", "稳定期"]):
            topic = "relapse_warning"
        elif any(term in lowered for term in ["起不来", "没动力", "不想动", "什么都不想做", "低落", "疲惫", "没力气", "兴趣", "情绪很沉"]):
            topic = "depressed_micro_action"

        inferred_risk = risk_level or "low"
        if any(term in lowered for term in ["自杀", "轻生", "不想活", "活着没意义", "结束这一切", "自残", "吞药", "过量", "从这个世界消失"]):
            inferred_risk = "crisis"
        elif any(term in lowered for term in ["崩溃", "受不了", "控制不住", "失控", "砸东西"]):
            inferred_risk = "medium"
        if inferred_risk in {"crisis", "high", "imminent"}:
            topic = "crisis_intervention"
        elif inferred_risk == "medium" and any(
            term in lowered for term in ["控制不住", "失控", "砸东西", "冒险"]
        ):
            topic = "de_escalation"

        inferred_state = bd_state or "stable"
        if inferred_state == "stable":
            if any(term in lowered for term in ["睡不着", "不需要睡", "精力", "停不下来", "脑子很快", "冲动", "躁"]):
                inferred_state = "manic"
            if any(term in lowered for term in ["低落", "无望", "没意义", "没动力", "崩溃", "绝望"]):
                inferred_state = "mixed" if inferred_state == "manic" else "depressed"
        if topic not in {"crisis_intervention", "de_escalation"} and inferred_state == "mixed" and any(
            term in lowered for term in ["烦躁", "停不下来", "坐不住", "加速", "冲动"]
        ):
            topic = "mixed_state_support"
        if topic == "general_support" and inferred_state == "mixed":
            topic = "mixed_state_support"
        elif topic == "general_support" and inferred_state == "depressed":
            topic = "depressed_micro_action"
        elif topic == "general_support" and inferred_state == "manic":
            topic = "manic_warning_signs"

        return {"topic": topic, "risk_level": inferred_risk, "bd_state": inferred_state}

    def _rerank_score(self, base_score: float, metadata: dict[str, Any], context: dict[str, str]) -> float:
        score = base_score
        doc_type = str(metadata.get("doc_type") or "")
        doc_risk = str(metadata.get("risk_level") or "low")
        doc_state = str(metadata.get("bd_state") or "stable")
        doc_topic = str(metadata.get("topic") or "")
        authority_level = str(metadata.get("authority_level") or "C")
        doc_region = str(metadata.get("region") or "")

        if doc_type in {"safety_rule", "medical_boundary", "clinical_knowledge", "product_knowledge", "support_strategy"}:
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
        if context["bd_state"] == "depressed" and doc_topic == "depressed_micro_action":
            score += 0.16
        if str(metadata.get("evidence_quality") or "") == "policy":
            score += 0.06
        if authority_level == "A":
            score += 0.12
        elif authority_level == "B":
            score += 0.04
        if context.get("region") == "CN" and doc_region == "CN":
            score += 0.1
        if str(metadata.get("intent") or "") in {"medication_decision", "seeking_diagnosis"} and context[
            "topic"
        ] in {"medication_boundary", "followup_summary"}:
            score += 0.04
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
            metadata = normalize_evidence_metadata(str(doc.get("source") or ""), doc.get("metadata") or {})
            if not self._eligible(metadata, context):
                continue
            searchable = f"{doc.get('retrieval_text', '')}\n{doc.get('text', '')}".lower()
            matches = sum(1 for term in query_terms if term in searchable)
            if not matches:
                continue
            score = matches / max(len(set(query_terms)), 1)
            score = self._rerank_score(score, metadata, context)
            scored.append((score, {**doc, "metadata": metadata}))

        scored.sort(key=lambda item: item[0], reverse=True)
        results: list[dict[str, Any]] = []
        for score, doc in scored[:top_k]:
            metadata = doc.get("metadata") or {}
            results.append(
                {
                    "doc_id": doc.get("doc_id"),
                    "source": doc.get("source"),
                    "score": round(min(score, 1.0), 4),
                    "summary": doc.get("text"),
                    "strategy": metadata.get("strategy"),
                    "metadata": {**metadata, "retrieval_mode": "lexical_rerank", "query_context": context},
                }
            )
        return results

    def _rewrite_queries(self, query: str, context: dict[str, str]) -> list[str]:
        expansions = {
            "sleep": "睡眠需求减少 失眠 昼夜节律 精力变化",
            "impulsivity": "冲动消费 冒险行为 重大决定 风险",
            "medication_boundary": "用药不良反应 漏服 停药 调整剂量 医生 药师",
            "followup_summary": "复诊 纵向病程 情绪 睡眠 精力 用药 触发因素",
            "crisis_intervention": "自伤 自杀 他伤 紧急风险 危机干预",
            "relapse_warning": "复发预警 维持期 睡眠 精力 冲动 个人基线",
            "mixed_state_support": "混合状态 烦躁 低落 精力 冲动 安全",
        }
        variants = [query]
        expansion = expansions.get(context.get("topic"))
        if expansion:
            variants.append(f"{query} {expansion}")
        if context.get("bd_state") in {"manic", "mixed", "depressed"}:
            variants.append(f"{query} 双相 {context['bd_state']}")
        return list(dict.fromkeys(variants))

    def _merge_ranked_lists(
        self, groups: list[list[dict[str, Any]]], limit: int
    ) -> list[dict[str, Any]]:
        merged: dict[str, dict[str, Any]] = {}
        for group in groups:
            for rank, item in enumerate(group, start=1):
                key = str(item.get("doc_id"))
                current = merged.setdefault(key, {**item, "_query_fusion": 0.0})
                current["_query_fusion"] += 1.0 / (40 + rank)
                current["score"] = max(float(current.get("score") or 0), float(item.get("score") or 0))
        results = list(merged.values())
        for item in results:
            item["score"] = round(float(item.get("score") or 0) + item.pop("_query_fusion"), 4)
        results.sort(key=lambda item: float(item.get("score") or 0), reverse=True)
        return results[:limit]

    def _second_stage_rerank(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        context: dict[str, str],
        top_k: int,
    ) -> list[dict[str, Any]]:
        query_terms = set(self._query_terms(query))
        reranked: list[tuple[float, dict[str, Any]]] = []
        for item in candidates:
            metadata = item.get("metadata") or {}
            searchable = f"{item.get('summary', '')} {metadata.get('section', '')}".lower()
            coverage = sum(1 for term in query_terms if term in searchable) / max(len(query_terms), 1)
            score = float(item.get("score") or 0) + coverage * 0.25
            if metadata.get("topic") == context.get("topic"):
                score += 0.55
            elif context.get("topic") in {"crisis_intervention", "medication_boundary", "de_escalation"}:
                score -= 0.18
            if metadata.get("region") == context.get("region"):
                score += 0.12
            if metadata.get("authority_level") == "A":
                score += 0.1
            enriched = {
                **item,
                "score": round(score, 4),
                "metadata": {**metadata, "reranker": "evidence_policy_v1"},
            }
            reranked.append((score, enriched))
        reranked.sort(key=lambda pair: pair[0], reverse=True)

        selected: list[dict[str, Any]] = []
        seen_text: set[str] = set()
        for _, item in reranked:
            fingerprint = re.sub(r"\W+", "", str(item.get("summary") or ""))[:80]
            if fingerprint in seen_text:
                continue
            seen_text.add(fingerprint)
            selected.append(item)
            if len(selected) >= top_k:
                break
        return selected

    def _fuse_results(
        self,
        vector_results: list[dict[str, Any]],
        lexical_results: list[dict[str, Any]],
        top_k: int,
        context: dict[str, str],
    ) -> list[dict[str, Any]]:
        combined: dict[str, dict[str, Any]] = {}
        rank_constant = 60

        for mode, results in (("vector", vector_results), ("lexical", lexical_results)):
            for rank, item in enumerate(results, start=1):
                key = str(item.get("doc_id") or f"{item.get('source')}::{item.get('summary')}")
                current = combined.setdefault(key, {**item, "fusion_modes": [], "fusion_score": 0.0})
                current["fusion_modes"].append(mode)
                current["fusion_score"] += 1.0 / (rank_constant + rank)
                current["score"] = max(float(current.get("score") or 0.0), float(item.get("score") or 0.0))

        fused = list(combined.values())
        for item in fused:
            metadata = item.get("metadata") or {}
            item["score"] = round(float(item.get("score") or 0.0) + float(item["fusion_score"]), 4)
            metadata["retrieval_mode"] = "+".join(sorted(set(item.pop("fusion_modes"))))
            metadata["query_context"] = context
            item["metadata"] = metadata

        fused.sort(key=lambda item: (float(item.get("score") or 0.0), float(item.get("fusion_score") or 0.0)), reverse=True)
        return fused[:top_k]

    def infer_strategy(self, results: list[dict[str, Any]]) -> str | None:
        strategies = [item.get("strategy") for item in results if item.get("strategy")]
        if not strategies:
            return None
        return Counter(strategies).most_common(1)[0][0]
