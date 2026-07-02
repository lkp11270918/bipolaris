from __future__ import annotations

import argparse
import json
import re
import sqlite3
from pathlib import Path
from typing import Any

from backend.settings import APP_DB_PATH, INTERACTION_LOG_PATH


BLOCKED_EVENT_KEYS = {
    "message",
    "content",
    "reply",
    "notes",
    "phone",
    "emergency_contact_phone",
    "raw_text",
    "conversation",
}

SENSITIVE_PATTERNS = {
    "phone_like": re.compile(r"1[3-9]\d{9}"),
    "email_like": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    "id_card_like": re.compile(r"\b\d{17}[\dXx]\b"),
}


def load_event_rows(db_path: Path) -> list[dict[str, Any]]:
    if not db_path.exists():
        return []
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT id, event_name, properties_json FROM event_logs ORDER BY event_time DESC LIMIT 5000"
        ).fetchall()
    except sqlite3.Error:
        return []
    finally:
        conn.close()
    return [dict(row) for row in rows]


def audit_event_logs(db_path: Path) -> list[str]:
    findings: list[str] = []
    for row in load_event_rows(db_path):
        try:
            props = json.loads(row.get("properties_json") or "{}")
        except json.JSONDecodeError:
            findings.append(f"{row.get('id')}: invalid properties_json")
            continue

        forbidden = BLOCKED_EVENT_KEYS.intersection(props.keys())
        if forbidden:
            findings.append(f"{row.get('id')}: forbidden analytics keys present: {sorted(forbidden)}")

        serialized = json.dumps(props, ensure_ascii=False)
        for name, pattern in SENSITIVE_PATTERNS.items():
            if pattern.search(serialized):
                findings.append(f"{row.get('id')}: possible {name} in analytics properties")
    return findings


def audit_interaction_log(path: Path) -> list[str]:
    findings: list[str] = []
    if not path.exists():
        return findings
    allowed_keys = {
        "risk_level",
        "bd_state",
        "selected_strategy",
        "used_openai",
        "rag_ready",
        "rag_documents",
        "retrieved_count",
        "rag_top_source",
        "latency_ms",
        "message_length",
        "history_turns",
        "timestamp",
    }
    with path.open("r", encoding="utf-8") as handle:
        for index, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                findings.append(f"interactions line {index}: invalid JSON")
                continue
            unexpected = set(payload.keys()) - allowed_keys
            if unexpected:
                findings.append(f"interactions line {index}: unexpected keys {sorted(unexpected)}")
            serialized = json.dumps(payload, ensure_ascii=False)
            for name, pattern in SENSITIVE_PATTERNS.items():
                if pattern.search(serialized):
                    findings.append(f"interactions line {index}: possible {name}")
    return findings


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit BiPolaris logs for sensitive analytics leakage")
    parser.add_argument("--db", type=Path, default=APP_DB_PATH)
    parser.add_argument("--interaction-log", type=Path, default=INTERACTION_LOG_PATH)
    args = parser.parse_args()

    findings = audit_event_logs(args.db) + audit_interaction_log(args.interaction_log)
    result = {"status": "pass" if not findings else "fail", "findings": findings}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(1 if findings else 0)


if __name__ == "__main__":
    main()
