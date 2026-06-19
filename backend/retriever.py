from __future__ import annotations

import json
import math
import re
import sqlite3
from collections import Counter
from typing import Any

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
        self._lexical_docs = []
        if not path.exists():
            return self._lexical_docs

        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    self._lexical_docs.append(json.loads(line))
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

    def search(self, query: str, top_k: int = 4, min_score: float = 0.18) -> list[dict[str, Any]]:
        query_embedding = self.embed_query(query)
        if not query_embedding:
            return self._lexical_search(query, top_k=top_k)

        scored: list[tuple[float, RagDocument]] = []
        for doc in self._load_docs():
            assert doc.embedding is not None
            score = cosine_similarity(query_embedding, doc.embedding)
            if score >= min_score:
                scored.append((score, doc))
        scored.sort(key=lambda item: item[0], reverse=True)

        results: list[dict[str, Any]] = []
        for score, doc in scored[:top_k]:
            results.append(
                {
                    "source": doc.source,
                    "score": round(score, 4),
                    "summary": doc.text,
                    "strategy": doc.metadata.get("strategy"),
                    "metadata": doc.metadata,
                }
            )
        return results or self._lexical_search(query, top_k=top_k)

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
        }
        for chinese_term, expansions in term_map.items():
            if chinese_term in lowered:
                terms.append(chinese_term)
                terms.extend(expansions)
        if len(lowered) <= 24:
            terms.extend(lowered[index : index + 2] for index in range(max(0, len(lowered) - 1)))
        return [term for term in terms if term.strip()]

    def _lexical_search(self, query: str, top_k: int = 4) -> list[dict[str, Any]]:
        docs = self._load_lexical_docs()
        if not docs:
            return []

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
                    "metadata": {**metadata, "retrieval_mode": "lexical"},
                }
            )
        return results

    def infer_strategy(self, results: list[dict[str, Any]]) -> str | None:
        strategies = [item.get("strategy") for item in results if item.get("strategy")]
        if not strategies:
            return None
        return Counter(strategies).most_common(1)[0][0]
