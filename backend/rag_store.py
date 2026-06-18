from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class RagDocument:
    doc_id: str
    source: str
    text: str
    retrieval_text: str
    metadata: dict[str, Any]
    embedding: list[float] | None = None


class RagStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def ensure_schema(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS rag_documents (
                    doc_id TEXT PRIMARY KEY,
                    source TEXT NOT NULL,
                    text TEXT NOT NULL,
                    retrieval_text TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    embedding_json TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_rag_documents_source
                ON rag_documents(source);
                """
            )

    def replace_documents(self, docs: list[RagDocument]) -> None:
        with self.connect() as conn:
            conn.execute("DELETE FROM rag_documents")
            conn.executemany(
                """
                INSERT INTO rag_documents (
                    doc_id, source, text, retrieval_text, metadata_json, embedding_json
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        doc.doc_id,
                        doc.source,
                        doc.text,
                        doc.retrieval_text,
                        json.dumps(doc.metadata, ensure_ascii=False),
                        json.dumps(doc.embedding) if doc.embedding is not None else None,
                    )
                    for doc in docs
                ],
            )

    def update_embeddings(self, docs: list[RagDocument]) -> None:
        with self.connect() as conn:
            conn.executemany(
                """
                UPDATE rag_documents
                SET embedding_json = ?
                WHERE doc_id = ?
                """,
                [(json.dumps(doc.embedding), doc.doc_id) for doc in docs if doc.embedding is not None],
            )

    def load_documents(self) -> list[RagDocument]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT doc_id, source, text, retrieval_text, metadata_json, embedding_json
                FROM rag_documents
                """
            ).fetchall()
        docs: list[RagDocument] = []
        for row in rows:
            docs.append(
                RagDocument(
                    doc_id=row["doc_id"],
                    source=row["source"],
                    text=row["text"],
                    retrieval_text=row["retrieval_text"],
                    metadata=json.loads(row["metadata_json"]),
                    embedding=json.loads(row["embedding_json"]) if row["embedding_json"] else None,
                )
            )
        return docs

    def count_documents(self) -> int:
        with self.connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS count FROM rag_documents").fetchone()
        return int(row["count"])
