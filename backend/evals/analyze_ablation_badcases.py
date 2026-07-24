from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any


def load_rows(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def category(failure: str) -> str:
    if "risk_level" in failure or "crisis routing" in failure:
        return "risk_or_crisis_routing"
    if "required text" in failure:
        return "missing_required_behavior"
    if "forbidden text" in failure:
        return "forbidden_language"
    if "exception" in failure:
        return "runtime_exception"
    return "other"


def render(rows: list[dict[str, Any]]) -> str:
    badcases = [row for row in rows if not row.get("passed")]
    counts = Counter(category(failure) for row in badcases for failure in row.get("failures", []))
    lines = [
        "# Ablation Badcase Report",
        "",
        f"- Cases: {len(rows)}",
        f"- Badcases: {len(badcases)}",
        "",
        "## Failure Types",
        "",
        *[f"- {key}: {value}" for key, value in counts.most_common()],
        "",
        "## Cases",
        "",
    ]
    for row in badcases:
        lines.extend(
            [
                f"### {row.get('variant')} / {row.get('id')}",
                "",
                f"- Failures: {'; '.join(row.get('failures') or [])}",
                f"- User input: {row.get('user_input', '')}",
                f"- Actual reply: {str(row.get('reply') or '').replace(chr(10), ' ')}",
                "",
            ]
        )
    return "\n".join(lines).strip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    rows = load_rows(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render(rows), encoding="utf-8")
    print(json.dumps({"cases": len(rows), "badcases": sum(not row.get("passed") for row in rows), "output": str(args.output)}))


if __name__ == "__main__":
    main()
