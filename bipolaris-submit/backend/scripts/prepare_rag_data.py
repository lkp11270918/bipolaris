from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from backend.rag_knowledge import CURATED_RAG_DOCS
from backend.settings import BIPOLAR_MAX_DOCS, ESCONV_MAX_TURNS, PROCESSED_DIR, RAW_DIR


ESCONV = "thu-coai/esconv"
KANAKMI = "Kanakmi/mental-disorders"
BIPOLAR_LABEL = 1
PARQUET_URLS = {
    "esconv-train": "https://huggingface.co/datasets/thu-coai/esconv/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet",
    "kanakmi-train": "https://huggingface.co/datasets/Kanakmi/mental-disorders/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet",
}


CRISIS_TERMS = ["自杀", "轻生", "不想活", "活着没意义", "结束这一切", "自残", "伤害自己", "吞药", "过量"]
MEDIUM_TERMS = ["崩溃", "受不了", "控制不住", "失控", "砸东西", "冲动", "冒险"]


def infer_risk_level(text: str) -> str:
    lowered = text.lower()
    if any(term in lowered for term in CRISIS_TERMS):
        return "crisis"
    if any(term in lowered for term in MEDIUM_TERMS):
        return "medium"
    return "low"


def infer_bd_state_from_text(text: str, fallback: str = "stable") -> str:
    lowered = text.lower()
    manic_terms = ["睡不着", "不需要睡", "精力", "停不下来", "脑子", "话多", "冲动", "花钱", "冒险", "manic", "hypomanic"]
    depressed_terms = ["低落", "无望", "没意义", "没动力", "疲惫", "不想动", "崩溃", "绝望", "depress", "hopeless"]
    manic = sum(1 for term in manic_terms if term in lowered)
    depressed = sum(1 for term in depressed_terms if term in lowered)
    if manic and depressed:
        return "mixed"
    if manic:
        return "manic"
    if depressed:
        return "depressed"
    return fallback


def infer_topic(text: str, metadata: dict[str, Any] | None = None) -> str:
    lowered = text.lower()
    metadata = metadata or {}
    problem_type = str(metadata.get("problem_type") or "").lower()
    if any(term in lowered for term in ["停药", "加药", "减药", "补服", "副作用", "medication", "lithium", "lamictal"]):
        return "medication_boundary"
    if any(term in lowered for term in ["睡", "失眠", "insomnia"]):
        return "sleep"
    if any(term in lowered for term in ["冲动", "花钱", "冒险", "impulsive"]):
        return "impulsivity"
    if any(term in lowered for term in ["复诊", "医生", "psychiatrist"]):
        return "followup"
    if "job" in problem_type or "work" in lowered or "工作" in lowered:
        return "work_stress"
    if any(term in lowered for term in ["relationship", "感情", "伴侣", "家人"]):
        return "relationship"
    return "general_support"


def infer_intent(text: str) -> str:
    lowered = text.lower()
    if any(term in lowered for term in ["怎么办", "怎么做", "建议", "help", "what should i do"]):
        return "seeking_action"
    if any(term in lowered for term in ["是不是", "诊断", "确诊", "am i", "do i have"]):
        return "seeking_diagnosis"
    if any(term in lowered for term in ["停药", "加药", "减药", "剂量", "med", "dose"]):
        return "medication_decision"
    if any(term in lowered for term in ["复诊", "报告", "摘要", "医生"]):
        return "followup_preparation"
    return "emotional_disclosure"


def evidence_quality(text: str, source: str) -> str:
    if source.startswith("bipolaris/"):
        return "policy"
    if len(text) < 80:
        return "low_context"
    if any(term in text.lower() for term in ["i ", "my ", "我", "自己"]):
        return "lived_experience"
    return "support_example"


def sentence_units(text: str) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    pieces = re.split(r"(?<=[。！？!?；;])\s+|(?<=[。！？!?；;])|(?<=\.)\s+", cleaned)
    return [piece.strip() for piece in pieces if piece.strip()]


def chunk_text(text: str, size: int = 720, overlap: int = 120) -> list[str]:
    cleaned = " ".join(text.split())
    if len(cleaned) <= size:
        return [cleaned]

    units = sentence_units(cleaned)
    if len(units) > 1:
        chunks: list[str] = []
        current = ""
        for unit in units:
            if current and len(current) + len(unit) + 1 > size:
                chunks.append(current.strip())
                current = current[-overlap:].strip() if overlap else ""
            current = f"{current} {unit}".strip()
        if current:
            chunks.append(current.strip())
        return chunks

    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(len(cleaned), start + size)
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(cleaned):
            break
        start = max(0, end - overlap)
    return chunks


def prepare_esconv(max_turns: int) -> list[dict[str, Any]]:
    train_path = RAW_DIR / "esconv-train.parquet"
    if not train_path.exists():
        raise FileNotFoundError(
            f"Missing raw file: {train_path}. Download it first from {PARQUET_URLS['esconv-train']}."
        )

    table = pq.read_table(train_path, columns=["text"])
    docs: list[dict[str, Any]] = []
    turn_count = 0
    for row_idx, raw_text in enumerate(table.column("text").to_pylist()):
        item = json.loads(raw_text)
        dialog = item.get("dialog", [])
        for turn_idx, turn in enumerate(dialog):
            if turn.get("speaker") != "sys":
                continue
            strategy = turn.get("strategy") or "Others"
            history = dialog[max(0, turn_idx - 3) : turn_idx]
            history_lines = [f"{entry.get('speaker')}: {entry.get('text', '').strip()}" for entry in history]
            retrieval_text = "\n".join(
                [
                    f"emotion_type: {item.get('emotion_type')}",
                    f"problem_type: {item.get('problem_type')}",
                    f"situation: {item.get('situation')}",
                    "recent_dialogue:",
                    *history_lines,
                    f"support_strategy: {strategy}",
                    f"assistant_response: {turn.get('text', '').strip()}",
                ]
            )
            docs.append(
                {
                    "doc_id": f"esconv-train-{row_idx}-turn-{turn_idx}",
                    "source": "thu-coai/esconv",
                    "text": turn.get("text", "").strip(),
                    "retrieval_text": retrieval_text,
            "metadata": {
                        "dataset": ESCONV,
                        "doc_type": "support_example",
                        "split": "train",
                        "emotion_type": item.get("emotion_type"),
                        "problem_type": item.get("problem_type"),
                        "strategy": strategy,
                        "situation": item.get("situation"),
                        "risk_level": infer_risk_level(retrieval_text),
                        "bd_state": infer_bd_state_from_text(retrieval_text),
                        "topic": infer_topic(retrieval_text, item),
                        "intent": infer_intent(retrieval_text),
                        "evidence_quality": evidence_quality(turn.get("text", ""), ESCONV),
                        "chunk_method": "dialogue_turn_window",
                        "chunk_size_chars": len(turn.get("text", "")),
                        "parent_id": f"esconv-train-{row_idx}",
                    },
                }
            )
            turn_count += 1
            if turn_count >= max_turns:
                return docs
    return docs


def bipolar_tags(text: str) -> list[str]:
    lowered = text.lower()
    tag_map = {
        "sleep": ["sleep", "insomnia", "睡", "失眠"],
        "impulsivity": ["impulsive", "冲动", "花钱", "promiscuous"],
        "medication": ["lamictal", "lithium", "medication", "药", "antipsychotic", "prozac"],
        "depression": ["depress", "低落", "无望", "累"],
        "mania": ["manic", "hypomanic", "停不下来", "精力", "4am"],
    }
    tags = [tag for tag, keywords in tag_map.items() if any(keyword in lowered for keyword in keywords)]
    return tags


def prepare_bipolar(max_docs: int) -> list[dict[str, Any]]:
    train_path = RAW_DIR / "kanakmi-train.parquet"
    if not train_path.exists():
        raise FileNotFoundError(
            f"Missing raw file: {train_path}. Download it first from {PARQUET_URLS['kanakmi-train']}."
        )

    docs: list[dict[str, Any]] = []
    doc_count = 0
    parquet_file = pq.ParquetFile(train_path)
    for batch in parquet_file.iter_batches(columns=["text", "label"], batch_size=2048):
        batch_rows = batch.to_pylist()
        for row_idx, row in enumerate(batch_rows):
            if int(row["label"]) != BIPOLAR_LABEL:
                continue
            text = row["text"].strip()
            if not text:
                continue
            for chunk_idx, chunk in enumerate(chunk_text(text)):
                docs.append(
                    {
                        "doc_id": f"kanakmi-train-{doc_count}-{chunk_idx}",
                        "source": "Kanakmi/mental-disorders",
                        "text": chunk,
                        "retrieval_text": f"bipolar lived experience narrative:\n{chunk}",
                        "metadata": {
                            "dataset": KANAKMI,
                            "doc_type": "lived_experience",
                            "split": "train",
                            "label": BIPOLAR_LABEL,
                            "strategy": "Reflection of feelings + Information + Providing Suggestions",
                            "tags": bipolar_tags(chunk),
                            "risk_level": infer_risk_level(chunk),
                            "bd_state": infer_bd_state_from_text(chunk),
                            "topic": infer_topic(chunk),
                            "intent": infer_intent(chunk),
                            "evidence_quality": evidence_quality(chunk, KANAKMI),
                            "chunk_method": "sentence_window",
                            "chunk_size_chars": len(chunk),
                            "parent_id": f"kanakmi-train-{doc_count}",
                            "chunk_index": chunk_idx,
                        },
                    }
                )
            doc_count += 1
            if doc_count >= max_docs:
                return docs
    return docs


def write_jsonl(path: Path, docs: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for doc in docs:
            handle.write(json.dumps(doc, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download and clean RAG corpora")
    parser.add_argument("--esconv-max-turns", type=int, default=ESCONV_MAX_TURNS)
    parser.add_argument("--bipolar-max-docs", type=int, default=BIPOLAR_MAX_DOCS)
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    esconv_docs = prepare_esconv(args.esconv_max_turns)
    bipolar_docs = prepare_bipolar(args.bipolar_max_docs)
    curated_docs = CURATED_RAG_DOCS

    write_jsonl(PROCESSED_DIR / "esconv.jsonl", esconv_docs)
    write_jsonl(PROCESSED_DIR / "bipolar.jsonl", bipolar_docs)
    write_jsonl(PROCESSED_DIR / "curated.jsonl", curated_docs)
    write_jsonl(PROCESSED_DIR / "corpus.jsonl", curated_docs + esconv_docs + bipolar_docs)

    print(
        json.dumps(
            {
                "esconv_docs": len(esconv_docs),
                "bipolar_docs": len(bipolar_docs),
                "curated_docs": len(curated_docs),
                "total_docs": len(curated_docs) + len(esconv_docs) + len(bipolar_docs),
                "output": str(PROCESSED_DIR / "corpus.jsonl"),
                "required_raw_files": {
                    "esconv_train": PARQUET_URLS["esconv-train"],
                    "kanakmi_train": PARQUET_URLS["kanakmi-train"],
                },
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
