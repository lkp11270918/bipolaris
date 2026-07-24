from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.retriever import LocalRetriever
from backend.settings import RAG_MIN_SCORE, RAG_TOP_K


@dataclass
class RagEvalResult:
    case_id: str
    passed: bool
    failures: list[str]
    top_result: dict[str, Any] | None
    results: list[dict[str, Any]]
    relevant_rank: int | None = None
    authority_a_hit: bool = False


def load_cases(path: Path) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                cases.append(json.loads(line))
    return cases


def check_case(case: dict[str, Any], results: list[dict[str, Any]]) -> RagEvalResult:
    failures: list[str] = []
    top = results[0] if results else None
    if not top:
        return RagEvalResult(case_id=case["id"], passed=False, failures=["no retrieval results"], top_result=None, results=[])

    metadata = top.get("metadata") or {}
    expected_source = case.get("expected_source")
    expected_sources = set(case.get("expected_source_any") or [])
    expected_doc_type = case.get("expected_top_doc_type")
    expected_topic = case.get("expected_topic")
    expected_topics = set(case.get("expected_topic_any") or [])
    expected_authority = case.get("expected_authority_level")
    expected_doc_id = case.get("expected_doc_id")

    def is_relevant(item: dict[str, Any]) -> bool:
        item_metadata = item.get("metadata") or {}
        return (
            (not expected_doc_id or item.get("doc_id") == expected_doc_id)
            and (not expected_source or item.get("source") == expected_source)
            and (not expected_sources or item.get("source") in expected_sources)
            and (not expected_doc_type or item_metadata.get("doc_type") == expected_doc_type)
            and (not expected_topic or item_metadata.get("topic") == expected_topic)
            and (not expected_topics or item_metadata.get("topic") in expected_topics)
            and (not expected_authority or item_metadata.get("authority_level") == expected_authority)
        )

    relevant_rank = next(
        (rank for rank, item in enumerate(results, start=1) if is_relevant(item)),
        None,
    )

    if expected_source and top.get("source") != expected_source:
        failures.append(f"top source expected {expected_source}, got {top.get('source')}")
    if expected_sources and top.get("source") not in expected_sources:
        failures.append(f"top source expected one of {sorted(expected_sources)}, got {top.get('source')}")
    if expected_doc_type and metadata.get("doc_type") != expected_doc_type:
        failures.append(f"top doc_type expected {expected_doc_type}, got {metadata.get('doc_type')}")
    if expected_topic and metadata.get("topic") != expected_topic:
        failures.append(f"top topic expected {expected_topic}, got {metadata.get('topic')}")
    if expected_topics and metadata.get("topic") not in expected_topics:
        failures.append(f"top topic expected one of {sorted(expected_topics)}, got {metadata.get('topic')}")
    if expected_authority and metadata.get("authority_level") != expected_authority:
        failures.append(f"top authority expected {expected_authority}, got {metadata.get('authority_level')}")
    if case.get("forbid_authority_c") and any(
        (item.get("metadata") or {}).get("authority_level") == "C" for item in results
    ):
        failures.append("authority C leaked into restricted retrieval")

    summary = str(top.get("summary") or "")
    for group_item in case.get("must_include_any", []):
        terms = group_item if isinstance(group_item, list) else [group_item]
        if not any(term in summary for term in terms):
            failures.append(f"top summary missing any of: {', '.join(terms)}")

    return RagEvalResult(
        case_id=case["id"],
        passed=not failures,
        failures=failures,
        top_result=top,
        results=results,
        relevant_rank=relevant_rank,
        authority_a_hit=any(
            str((item.get("metadata") or {}).get("authority_level")) == "A" for item in results
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate RAG retrieval quality")
    parser.add_argument("--cases", type=Path, default=Path("backend/evals/rag_retrieval_cases.jsonl"))
    parser.add_argument("--out", type=Path, default=Path("backend/evals/results/rag_retrieval_latest.jsonl"))
    parser.add_argument("--top-k", type=int, default=RAG_TOP_K)
    parser.add_argument("--min-score", type=float, default=RAG_MIN_SCORE)
    args = parser.parse_args()

    retriever = LocalRetriever(api_key=None)
    cases = load_cases(args.cases)
    results: list[RagEvalResult] = []
    for case in cases:
        retrieved = retriever.search(
            case["query"],
            top_k=args.top_k,
            min_score=args.min_score,
            bd_state=case.get("bd_state"),
            risk_level=case.get("risk_level"),
            medical_fact_required=bool(case.get("requires_authority_a")),
        )
        results.append(check_case(case, retrieved))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as handle:
        for result in results:
            handle.write(
                json.dumps(
                    {
                        "id": result.case_id,
                        "passed": result.passed,
                        "failures": result.failures,
                        "top_result": result.top_result,
                        "results": result.results,
                        "relevant_rank": result.relevant_rank,
                        "authority_a_hit": result.authority_a_hit,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )

    passed = sum(1 for result in results if result.passed)
    recall_at_k = sum(1 for result in results if result.relevant_rank is not None) / len(results) if results else 0
    mrr = (
        sum(1 / result.relevant_rank for result in results if result.relevant_rank is not None) / len(results)
        if results
        else 0
    )
    authority_required = [result for case, result in zip(cases, results) if case.get("requires_authority_a")]
    authority_hit_rate = (
        sum(1 for result in authority_required if result.authority_a_hit) / len(authority_required)
        if authority_required
        else 0
    )
    print(
        json.dumps(
            {
                "cases": len(results),
                "passed": passed,
                "failed": len(results) - passed,
                "pass_rate": round(passed / len(results), 4) if results else 0.0,
                "recall_at_k": round(recall_at_k, 4),
                "mrr": round(mrr, 4),
                "authority_a_hit_rate": round(authority_hit_rate, 4),
                "out": str(args.out),
            },
            ensure_ascii=False,
        )
    )
    raise SystemExit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
