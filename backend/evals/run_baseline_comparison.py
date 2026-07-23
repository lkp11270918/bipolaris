from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
from pathlib import Path
from typing import Any

from backend.evals.run_eval import load_cases, run_case
from backend.settings import OPENAI_MODEL

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None  # type: ignore[assignment]


RAW_INSTRUCTIONS = """你是一个通用中文 AI 助手。请直接回应用户，提供有帮助、自然且安全的回答。"""


def raw_reply(case: dict[str, Any], model: str) -> str:
    if OpenAI is None or not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is required")
    response = OpenAI().responses.create(
        model=model,
        instructions=RAW_INSTRUCTIONS,
        input=case["message"],
        max_output_tokens=850,
    )
    return response.output_text.strip()


async def run_pair(case: dict[str, Any], model: str) -> dict[str, Any]:
    specialized = await run_case(case)
    baseline = await asyncio.to_thread(raw_reply, case, model)
    return {
        "id": case["id"],
        "user_input": case["message"],
        "history": case.get("history", []),
        "baseline_reply": baseline,
        "bipolaris_reply": specialized.response.get("reply", ""),
        "bipolaris_risk": specialized.response.get("risk_level"),
        "bipolaris_state": specialized.response.get("context_payload", {}).get("inferred_bd_state"),
        "bipolaris_passed_rules": specialized.passed,
        "bipolaris_failures": specialized.failures,
        "manual_preference": "",
        "manual_bipolar_relevance_1_5": "",
        "manual_empathy_1_5": "",
        "manual_actionability_1_5": "",
        "manual_safety_1_5": "",
        "manual_notes": "",
    }


async def main_async() -> None:
    parser = argparse.ArgumentParser(description="Blind comparison: raw base model vs BiPolaris")
    parser.add_argument("--cases", type=Path, default=Path("backend/evals/specialized_benchmark.jsonl"))
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--model", default=OPENAI_MODEL)
    parser.add_argument("--out-jsonl", type=Path, default=Path("backend/evals/results/baseline_comparison_latest.jsonl"))
    parser.add_argument("--out-csv", type=Path, default=Path("backend/evals/results/baseline_comparison_review.csv"))
    args = parser.parse_args()
    cases = load_cases(args.cases)[: args.limit]
    rows = [await run_pair(case, args.model) for case in cases]
    args.out_jsonl.parent.mkdir(parents=True, exist_ok=True)
    args.out_jsonl.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")
    with args.out_csv.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else [])
        if rows:
            writer.writeheader()
            writer.writerows(rows)
    failed = [row for row in rows if not row["bipolaris_passed_rules"]]
    print(json.dumps({"cases": len(rows), "rule_badcases": len(failed), "review_csv": str(args.out_csv)}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main_async())
