from __future__ import annotations

import argparse
import json
from pathlib import Path

from backend.crypto import decrypt_text
from backend.settings import FEEDBACK_PATH


def main() -> None:
    parser = argparse.ArgumentParser(description="Export user-authorized feedback badcases for internal review")
    parser.add_argument("--input", type=Path, default=FEEDBACK_PATH)
    parser.add_argument("--output", type=Path, default=Path("backend/evals/results/user_feedback_badcases.jsonl"))
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    exported = 0
    with args.output.open("w", encoding="utf-8") as target:
        if args.input.exists():
            for raw_line in args.input.read_text(encoding="utf-8").splitlines():
                if not raw_line.strip():
                    continue
                row = json.loads(raw_line)
                if row.get("label") == "helpful":
                    continue
                row["user_message"] = decrypt_text(str(row.get("user_message") or ""))
                row["assistant_reply"] = decrypt_text(str(row.get("assistant_reply") or ""))
                target.write(json.dumps(row, ensure_ascii=False) + "\n")
                exported += 1
    print(json.dumps({"exported": exported, "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
