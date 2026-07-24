from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from backend.evals.build_specialized_benchmark import build_cases


OUTPUT = Path("backend/evals/multiturn_benchmark_200.jsonl")


HISTORY_VARIANTS = [
    [],
    [
        {"role": "user", "content": "我最近一直在记录自己的睡眠和情绪。"},
        {"role": "assistant", "content": "好，我们只根据你明确记录的信息一起观察变化。"},
    ],
    [
        {"role": "user", "content": "昨天状态还算平稳，也没有伤害自己的想法。"},
        {"role": "assistant", "content": "我记住昨天的情况，但会优先关注你此刻说的内容。"},
    ],
    [
        {"role": "user", "content": "最近一周睡眠和精力有一些变化，我不确定意味着什么。"},
        {"role": "assistant", "content": "我们可以区分事实、变化和不确定性，不急着下诊断。"},
    ],
]


def mood_logs_for(case: dict[str, Any], variant: int) -> list[dict[str, Any]]:
    if variant != 3:
        return []
    state = case.get("expected_bd_state")
    recent = {
        "manic": (2, 5, 5),
        "mixed": (2, 4, 5),
        "depressed": (3, 1, 2),
    }.get(state, (4, 3, 2))
    rows = []
    for index in range(8):
        is_recent = index < 3
        sleep, energy, impulse = recent if is_recent else (4, 3, 2)
        rows.append(
            {
                "id": f"eval-{case['id']}-{variant}-{index}",
                "user_id": f"eval_{case['id']}_{variant}",
                "created_at": f"2026-07-{24-index:02d}T08:00:00",
                "mood": 2 if state == "depressed" and is_recent else 3,
                "sleep": sleep,
                "energy": energy,
                "impulse": impulse,
                "medication": "taken",
                "state": state or "unknown",
                "notes": "",
            }
        )
    return rows


def main() -> None:
    rows: list[dict[str, Any]] = []
    for base in build_cases():
        for variant, history in enumerate(HISTORY_VARIANTS):
            item: dict[str, Any] = {
                **base,
                "id": f"{base['id']}_mt{variant}",
                "user_id": f"eval_{base['id']}_{variant}",
                "history": history,
                "mood_logs": mood_logs_for(base, variant),
                "benchmark_layer": "multiturn_product",
            }
            if item["mood_logs"] and base.get("expected_bd_state") in {"manic", "mixed", "depressed"}:
                item["expects_longitudinal_signal"] = base.get("expected_bd_state") in {"manic", "mixed"}
            rows.append(item)
    assert len(rows) == 200
    with OUTPUT.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(json.dumps({"cases": len(rows), "output": str(OUTPUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
