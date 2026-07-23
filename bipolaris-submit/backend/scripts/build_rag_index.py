from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from openai import OpenAI

from backend.rag_store import RagDocument, RagStore
from backend.settings import DB_PATH, OPENAI_EMBEDDING_MODEL, PROCESSED_DIR, load_local_env


def batched(items: list[RagDocument], batch_size: int) -> list[list[RagDocument]]:
    return [items[index : index + batch_size] for index in range(0, len(items), batch_size)]


def load_corpus(path: Path) -> list[RagDocument]:
    docs: list[RagDocument] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            payload = json.loads(line)
            docs.append(
                RagDocument(
                    doc_id=payload["doc_id"],
                    source=payload["source"],
                    text=payload["text"],
                    retrieval_text=payload["retrieval_text"],
                    metadata=payload["metadata"],
                )
            )
    return docs


def main() -> None:
    parser = argparse.ArgumentParser(description="Build local RAG sqlite index with OpenAI embeddings")
    parser.add_argument("--corpus", type=Path, default=PROCESSED_DIR / "corpus.jsonl")
    parser.add_argument("--db", type=Path, default=DB_PATH)
    parser.add_argument("--embedding-model", default=OPENAI_EMBEDDING_MODEL)
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    load_local_env()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is required to build the embedding index.")

    docs = load_corpus(args.corpus)
    store = RagStore(args.db)
    store.ensure_schema()

    client = OpenAI(api_key=api_key)
    for batch in batched(docs, args.batch_size):
        response = client.embeddings.create(
            model=args.embedding_model,
            input=[doc.retrieval_text for doc in batch],
        )
        for doc, item in zip(batch, response.data):
            doc.embedding = list(item.embedding)

    store.replace_documents(docs)
    print(json.dumps({"documents_indexed": len(docs), "db_path": str(args.db)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
