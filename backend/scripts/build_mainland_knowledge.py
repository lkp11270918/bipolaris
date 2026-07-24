from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


SOURCE_URL = (
    "https://www.nhc.gov.cn/wjw/c100175/202012/"
    "d21da62f7a654ae28650bc473f6d05e3/files/1644833637272_77437.pdf"
)


def normalize(text: str) -> str:
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"^\d+$", "", text)
    return text.strip()


def infer_topic(text: str) -> str:
    rules = [
        ("medication_boundary", ("药物", "锂盐", "丙戊酸", "抗精神病药", "抗抑郁药")),
        ("crisis_intervention", ("自杀", "攻击行为", "伤人", "危机干预", "自伤")),
        ("sleep", ("睡眠", "昼夜节律")),
        ("impulsivity", ("冲动", "冒险", "活动增加", "兴奋")),
        ("relapse_warning", ("复发", "维持期", "预防", "长期治疗")),
        ("followup_summary", ("评估", "监测", "病史", "随访")),
        ("mixed_state_support", ("混合", "快速循环")),
        ("depressive_signs", ("抑郁", "心境低落", "兴趣减少")),
        ("manic_warning_signs", ("躁狂", "轻躁狂", "心境高涨", "精力旺盛")),
    ]
    for topic, terms in rules:
        if any(term in text for term in terms):
            return topic
    return "bipolar_education"


def applicable_states(text: str) -> list[str]:
    states = []
    for state, terms in {
        "manic": ("躁狂", "轻躁狂"),
        "depressed": ("抑郁", "心境低落"),
        "mixed": ("混合", "快速循环"),
        "stable": ("维持期", "缓解期", "预防复发"),
    }.items():
        if any(term in text for term in terms):
            states.append(state)
    return states or ["any"]


def split_units(text: str, target: int = 220, overlap_sentences: int = 1) -> list[str]:
    if len(text) > target * 2 and not re.search(r"[。！？；]", text):
        return [
            text[start : start + target]
            for start in range(0, len(text), target - 60)
            if len(text[start : start + target]) >= 60
        ]
    sentences = [item for item in re.split(r"(?<=[。！？；])", text) if item]
    chunks: list[str] = []
    current: list[str] = []
    for sentence in sentences:
        if current and len("".join(current)) + len(sentence) > target:
            chunks.append("".join(current))
            current = current[-overlap_sentences:] if overlap_sentences else []
        current.append(sentence)
    if current:
        chunks.append("".join(current))
    return [chunk for chunk in chunks if len(chunk) >= 60]


def extract_chapter(pdf_path: Path) -> list[dict[str, Any]]:
    reader = PdfReader(str(pdf_path))
    pages = [normalize(page.extract_text() or "") for page in reader.pages]
    chapter_pages = [i for i, text in enumerate(pages) if "第四章双相障碍" in text]
    start_page = chapter_pages[-1]
    end_page = next(i for i in range(start_page + 1, len(pages)) if "第五章抑郁障碍" in pages[i])

    docs: list[dict[str, Any]] = []
    section = "双相障碍"
    doc_index = 0
    for page_index in range(start_page, end_page + 1):
        page_text = pages[page_index]
        page_text = page_text.split("第四章双相障碍", 1)[-1] if page_index == start_page else page_text
        page_text = page_text.split("第五章抑郁障碍", 1)[0]
        headings = re.split(r"(?=(?:[一二三四五六七八九十]+、|（[一二三四五六七八九十]+）))", page_text)
        for block in headings:
            heading_match = re.match(r"((?:[一二三四五六七八九十]+、|（[一二三四五六七八九十]+）)[^。；]{1,30})", block)
            if heading_match:
                section = heading_match.group(1)
            for chunk in split_units(block):
                if chunk.count(".") > len(chunk) / 4 or "目录" in chunk:
                    continue
                topic = infer_topic(chunk)
                user_facing_allowed = topic != "medication_boundary"
                docs.append(
                    {
                        "doc_id": f"nhc-bipolar-2020-{doc_index:03d}",
                        "source": "国家卫生健康委员会/精神障碍诊疗规范2020",
                        "text": chunk,
                        "retrieval_text": f"双相障碍 {section} {topic} {chunk}",
                        "metadata": {
                            "dataset": "nhc-mainland-guideline",
                            "doc_type": "official_guideline",
                            "authority_level": "A",
                            "evidence_type": "guideline",
                            "source_title": "精神障碍诊疗规范（2020年版）第四章 双相障碍",
                            "source_url": SOURCE_URL,
                            "published_at": "2020-11-01",
                            "reviewed_at": "2026-07-24",
                            "region": "CN",
                            "topic": topic,
                            "topics": [topic],
                            "bd_state": applicable_states(chunk)[0],
                            "applicable_states": applicable_states(chunk),
                            "risk_level": "medium" if topic == "crisis_intervention" else "low",
                            "medical_fact_allowed": user_facing_allowed,
                            "user_facing_allowed": user_facing_allowed,
                            "audience": "clinician",
                            "page_pdf": page_index + 1,
                            "page_printed": page_index - start_page + 139,
                            "section": section,
                            "chunk_method": "heading_sentence_window",
                            "chunk_size_chars": len(chunk),
                        },
                    }
                )
                doc_index += 1
    return docs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("backend/data/knowledge/mainland_authoritative.jsonl"),
    )
    args = parser.parse_args()
    docs = extract_chapter(args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        for doc in docs:
            handle.write(json.dumps(doc, ensure_ascii=False) + "\n")
    print(json.dumps({"documents": len(docs), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
