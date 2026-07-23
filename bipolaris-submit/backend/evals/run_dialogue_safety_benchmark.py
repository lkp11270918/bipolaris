from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from backend.evals import analyze_badcases, build_dialogue_safety_benchmark, run_eval


DEFAULT_CASES = Path("backend/evals/dialogue_safety_benchmark.jsonl")
DEFAULT_JSONL = Path("backend/evals/results/dialogue_safety_latest.jsonl")
DEFAULT_CSV = Path("backend/evals/results/dialogue_safety_latest.csv")
DEFAULT_BADCASE_REPORT = Path("backend/evals/results/dialogue_safety_badcase_report.md")


async def main_async() -> None:
    parser = argparse.ArgumentParser(description="Run DialogueSafety-backed BiPolaris benchmark")
    parser.add_argument("--limit", type=int, default=0, help="Optional smoke-test limit. 0 runs all 800 cases.")
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--out-jsonl", type=Path, default=DEFAULT_JSONL)
    parser.add_argument("--out-csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--badcase-report", type=Path, default=DEFAULT_BADCASE_REPORT)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--case-timeout", type=float, default=45.0)
    parser.add_argument("--progress-every", type=int, default=25)
    args = parser.parse_args()

    rows = build_dialogue_safety_benchmark.load_rows(build_dialogue_safety_benchmark.DEFAULT_INPUT)
    if args.limit > 0:
        rows = rows[: args.limit]
    cases = [build_dialogue_safety_benchmark.make_case(row, index) for index, row in enumerate(rows, start=1)]
    build_dialogue_safety_benchmark.write_jsonl(args.cases, cases)

    semaphore = asyncio.Semaphore(max(args.concurrency, 1))

    async def run_limited(case: dict[str, Any]) -> run_eval.EvalResult:
        async with semaphore:
            try:
                return await asyncio.wait_for(
                    asyncio.to_thread(lambda: asyncio.run(run_eval.run_case(case))),
                    timeout=args.case_timeout,
                )
            except TimeoutError:
                return run_eval.EvalResult(
                    case_id=case["id"],
                    passed=False,
                    score=0.0,
                    failures=[f"exception: TimeoutError: case exceeded {args.case_timeout}s"],
                    response={},
                    case=case,
                )

    tasks = [asyncio.create_task(run_limited(case)) for case in cases]
    results: list[run_eval.EvalResult] = []
    for task in asyncio.as_completed(tasks):
        results.append(await task)
        if args.progress_every > 0 and len(results) % args.progress_every == 0:
            print(
                json.dumps(
                    {
                        "progress": len(results),
                        "total": len(cases),
                        "passed": sum(1 for result in results if result.passed),
                        "failed": sum(1 for result in results if not result.passed),
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )
    run_eval.write_jsonl(args.out_jsonl, results)
    run_eval.write_csv(args.out_csv, results)

    loaded = analyze_badcases.load_results(args.out_jsonl)
    report = analyze_badcases.render_markdown(analyze_badcases.summarize(loaded))
    args.badcase_report.parent.mkdir(parents=True, exist_ok=True)
    args.badcase_report.write_text(report, encoding="utf-8")

    passed = sum(1 for result in results if result.passed)
    average_score = sum(result.score for result in results) / len(results) if results else 0
    print(
        json.dumps(
            {
                "benchmark": "qiuhuachuan/DialogueSafety",
                "cases": len(results),
                "passed": passed,
                "failed": len(results) - passed,
                "average_score": round(average_score, 4),
                "jsonl": str(args.out_jsonl),
                "csv": str(args.out_csv),
                "badcase_report": str(args.badcase_report),
            },
            ensure_ascii=False,
        )
    )


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
