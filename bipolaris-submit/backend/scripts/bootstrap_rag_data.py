from __future__ import annotations

import argparse
import json
import urllib.request
from pathlib import Path

from backend.scripts.prepare_rag_data import PARQUET_URLS, prepare_bipolar, prepare_esconv, write_jsonl
from backend.settings import BIPOLAR_MAX_DOCS, ESCONV_MAX_TURNS, PROCESSED_DIR, RAW_DIR


def download_if_missing(url: str, output_path: Path) -> None:
    if output_path.exists() and output_path.stat().st_size > 0:
        return
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as response:
        output_path.write_bytes(response.read())


def main() -> None:
    parser = argparse.ArgumentParser(description="Download and prepare a lightweight online RAG corpus")
    parser.add_argument("--esconv-max-turns", type=int, default=min(ESCONV_MAX_TURNS, 120))
    parser.add_argument("--bipolar-max-docs", type=int, default=min(BIPOLAR_MAX_DOCS, 160))
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    download_if_missing(PARQUET_URLS["esconv-train"], RAW_DIR / "esconv-train.parquet")
    download_if_missing(PARQUET_URLS["kanakmi-train"], RAW_DIR / "kanakmi-train.parquet")

    esconv_docs = prepare_esconv(args.esconv_max_turns)
    bipolar_docs = prepare_bipolar(args.bipolar_max_docs)
    docs = esconv_docs + bipolar_docs

    write_jsonl(PROCESSED_DIR / "esconv.jsonl", esconv_docs)
    write_jsonl(PROCESSED_DIR / "bipolar.jsonl", bipolar_docs)
    write_jsonl(PROCESSED_DIR / "corpus.jsonl", docs)

    print(
        json.dumps(
            {
                "esconv_docs": len(esconv_docs),
                "bipolar_docs": len(bipolar_docs),
                "total_docs": len(docs),
                "output": str(PROCESSED_DIR / "corpus.jsonl"),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
