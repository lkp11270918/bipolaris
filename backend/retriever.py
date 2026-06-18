from __future__ import annotations

import math
import sqlite3
from collections import Counter
from typing import Any

from .rag_store import RagDocument, RagStore
from .settings import DB_PATH, OPENAI_EMBEDDING_MODEL

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

    def is_ready(self) -> bool:
        return bool(self._load_docs())

    def count_documents(self) -> int:
        return len(self._load_docs())

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
            return []

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
        return results

    def infer_strategy(self, results: list[dict[str, Any]]) -> str | None:
        strategies = [item.get("strategy") for item in results if item.get("strategy")]
        if not strategies:
            return None
        return Counter(strategies).most_common(1)[0][0]
