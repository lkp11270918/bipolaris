from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


DEFAULT_INPUT = Path("backend/evals/results/latest.jsonl")
DEFAULT_OUTPUT = Path("backend/evals/results/badcase_report.md")


def load_results(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def classify_failure(failure: str) -> str:
    if "risk_level" in failure:
        return "risk_misclassification"
    if "bd_state" in failure:
        return "state_misclassification"
    if "forbidden text" in failure:
        return "forbidden_language"
    if "missing required" in failure:
        return "missing_required_behavior"
    if "too many questions" in failure:
        return "too_many_questions"
    if "crisis case should not call" in failure:
        return "crisis_routing_error"
    if "judge badcase" in failure:
        return "judge_badcase"
    if "exception" in failure:
        return "runtime_exception"
    return "other"


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    badcases = [row for row in rows if not row.get("passed")]
    by_failure_type: Counter[str] = Counter()
    by_risk: Counter[str] = Counter()
    by_state: Counter[str] = Counter()
    by_judge_type: Counter[str] = Counter()
    examples_by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for row in badcases:
        response = row.get("response") or {}
        payload = response.get("context_payload") or {}
        by_risk[str(response.get("risk_level") or "unknown")] += 1
        by_state[str(payload.get("inferred_bd_state") or "unknown")] += 1

        for failure in row.get("failures") or []:
            failure_type = classify_failure(failure)
            by_failure_type[failure_type] += 1
            if len(examples_by_type[failure_type]) < 3:
                examples_by_type[failure_type].append(row)

        judge = row.get("judge") or {}
        for judge_type in judge.get("badcase_types") or []:
            by_judge_type[str(judge_type)] += 1

    return {
        "total": len(rows),
        "passed": sum(1 for row in rows if row.get("passed")),
        "failed": len(badcases),
        "average_score": round(sum(float(row.get("score") or 0) for row in rows) / len(rows), 4) if rows else 0,
        "by_failure_type": by_failure_type,
        "by_risk": by_risk,
        "by_state": by_state,
        "by_judge_type": by_judge_type,
        "examples_by_type": examples_by_type,
    }


def format_counter(counter: Counter[str]) -> str:
    if not counter:
        return "- 暂无\n"
    return "".join(f"- {key}: {value}\n" for key, value in counter.most_common())


def short_reply(row: dict[str, Any], limit: int = 180) -> str:
    reply = ((row.get("response") or {}).get("reply") or "").replace("\n", " ")
    return reply[:limit] + ("..." if len(reply) > limit else "")


def render_markdown(summary: dict[str, Any]) -> str:
    lines = [
        "# BiPolaris Badcase Report",
        "",
        "## Summary",
        "",
        f"- Total cases: {summary['total']}",
        f"- Passed: {summary['passed']}",
        f"- Failed: {summary['failed']}",
        f"- Average score: {summary['average_score']}",
        "",
        "## Failure Types",
        "",
        format_counter(summary["by_failure_type"]).rstrip(),
        "",
        "## Risk Levels In Badcases",
        "",
        format_counter(summary["by_risk"]).rstrip(),
        "",
        "## BD States In Badcases",
        "",
        format_counter(summary["by_state"]).rstrip(),
        "",
        "## LLM Judge Badcase Types",
        "",
        format_counter(summary["by_judge_type"]).rstrip(),
        "",
        "## Representative Examples",
        "",
    ]

    examples_by_type: dict[str, list[dict[str, Any]]] = summary["examples_by_type"]
    if not examples_by_type:
        lines.append("No badcases found in this run.")
    for failure_type, examples in examples_by_type.items():
        lines.extend([f"### {failure_type}", ""])
        for row in examples:
            failures = "; ".join(row.get("failures") or [])
            lines.extend(
                [
                    f"- Case: `{row.get('id')}`",
                    f"  - Score: {row.get('score')}",
                    f"  - Failures: {failures}",
                    f"  - Reply: {short_reply(row)}",
                ]
            )
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze BiPolaris eval badcases")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    rows = load_results(args.input)
    report = render_markdown(summarize(rows))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report, encoding="utf-8")
    print(json.dumps({"input": str(args.input), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
