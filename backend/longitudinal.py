from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
import re
from statistics import mean, median, pstdev
from typing import Any


METRICS = ("mood", "sleep", "energy", "impulse")


def _parse_datetime(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _average(rows: list[dict[str, Any]], key: str) -> float | None:
    values = [float(row[key]) for row in rows if row.get(key) is not None]
    return round(mean(values), 2) if values else None


def _window_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    states = Counter(str(row.get("state") or "unknown") for row in rows)
    metric_summary: dict[str, Any] = {}
    for metric in METRICS:
        values = [float(row[metric]) for row in rows if row.get(metric) is not None]
        metric_summary[f"avg_{metric}"] = round(mean(values), 2) if values else None
        metric_summary[f"median_{metric}"] = round(median(values), 2) if values else None
        metric_summary[f"range_{metric}"] = (
            [round(min(values), 2), round(max(values), 2)] if values else None
        )
        metric_summary[f"volatility_{metric}"] = round(pstdev(values), 2) if len(values) >= 2 else 0.0
    return {
        "records": len(rows),
        **metric_summary,
        "state_counts": dict(states),
        "dominant_state": states.most_common(1)[0][0] if states else "unknown",
    }


def _consecutive_warning_days(dated: list[tuple[datetime, dict[str, Any]]]) -> int:
    longest = current = 0
    previous_date = None
    for created_at, row in dated:
        warning = (
            float(row.get("sleep") or 0) <= 2
            or float(row.get("impulse") or 0) >= 4
            or str(row.get("state")) in {"manic", "mixed"}
        )
        date = created_at.date()
        contiguous = previous_date is None or (previous_date - date).days <= 1
        current = current + 1 if warning and contiguous else (1 if warning else 0)
        longest = max(longest, current)
        previous_date = date
    return longest


def extract_dialogue_signals(messages: list[str]) -> list[dict[str, Any]]:
    text = "\n".join(messages[-8:])
    signals: list[dict[str, Any]] = []
    sleep_match = re.search(r"(?:睡了|每天睡|只睡)\s*(\d+(?:\.\d+)?)\s*(?:个)?小时", text)
    if sleep_match:
        signals.append(
            {
                "metric": "sleep_hours",
                "value": float(sleep_match.group(1)),
                "evidence": sleep_match.group(0),
                "source": "explicit_dialogue",
            }
        )
    explicit_rules = {
        "reduced_sleep_need": ("不需要睡", "睡很少也不困", "几天没睡"),
        "increased_energy": ("精力特别高", "精力旺盛", "停不下来"),
        "increased_impulsivity": ("冲动花钱", "控制不住购物", "冒险决定", "开快车"),
        "medication_interruption": ("停药", "漏服", "忘记吃药", "没吃药"),
        "depressive_function_loss": ("起不来", "什么都不想做", "没有力气"),
    }
    for signal, terms in explicit_rules.items():
        matched = next((term for term in terms if term in text), None)
        if matched:
            signals.append(
                {
                    "signal": signal,
                    "evidence": matched,
                    "source": "explicit_dialogue",
                }
            )
    return signals[:8]


def build_longitudinal_state(logs: list[dict[str, Any]]) -> dict[str, Any]:
    dated = [(parsed, row) for row in logs if (parsed := _parse_datetime(row.get("created_at")))]
    dated.sort(key=lambda item: item[0], reverse=True)
    if not dated:
        return {
            "record_count": 0,
            "windows": {"3d": _window_summary([]), "7d": _window_summary([]), "30d": _window_summary([])},
            "change_signals": [],
            "combined_signals": [],
            "evidence": [],
        }

    anchor = dated[0][0]
    windows: dict[str, list[dict[str, Any]]] = {}
    for days in (3, 7, 30):
        cutoff = anchor - timedelta(days=days - 1)
        windows[f"{days}d"] = [row for created_at, row in dated if created_at >= cutoff]

    summaries = {name: _window_summary(rows) for name, rows in windows.items()}
    summaries["3d"]["dates"] = [str(row.get("created_at") or "") for row in windows["3d"]]
    summaries["7d"]["dates"] = [str(row.get("created_at") or "") for row in windows["7d"]]
    summaries["30d"]["dates"] = [str(row.get("created_at") or "") for row in windows["30d"]]
    baseline_rows = windows["30d"]
    recent_rows = windows["3d"]
    signals: list[dict[str, Any]] = []
    if len(recent_rows) >= 2 and len(baseline_rows) >= 4:
        thresholds = {"mood": -0.8, "sleep": -0.8, "energy": 0.8, "impulse": 0.8}
        labels = {
            "mood": "近 3 天情绪低于个人 30 天基线",
            "sleep": "近 3 天睡眠低于个人 30 天基线",
            "energy": "近 3 天精力高于个人 30 天基线",
            "impulse": "近 3 天冲动高于个人 30 天基线",
        }
        for metric, threshold in thresholds.items():
            recent = summaries["3d"].get(f"avg_{metric}")
            baseline = summaries["30d"].get(f"avg_{metric}")
            if recent is None or baseline is None:
                continue
            delta = round(recent - baseline, 2)
            if (threshold < 0 and delta <= threshold) or (threshold > 0 and delta >= threshold):
                signals.append(
                    {
                        "metric": metric,
                        "window": "3d",
                        "recent": recent,
                        "baseline_window": "30d",
                        "baseline": baseline,
                        "delta": delta,
                        "label": labels[metric],
                        "source_dates": [str(row.get("created_at") or "") for row in recent_rows],
                    }
                )

    changed = {signal["metric"] for signal in signals}
    combined: list[dict[str, Any]] = []
    if {"sleep", "energy"}.issubset(changed) or {"sleep", "impulse"}.issubset(changed):
        combined.append(
            {
                "signal": "睡眠下降并伴随精力或冲动上升",
                "label": "出现相对个人基线的上行预警组合，建议加强观察并联系现实支持",
                "not_a_diagnosis": True,
            }
        )
    if {"mood", "energy"}.issubset(changed):
        combined.append(
            {
                "signal": "情绪下降并伴随精力变化",
                "label": "出现相对个人基线的混合变化，需要优先关注安全与稳定",
                "not_a_diagnosis": True,
            }
        )

    evidence = [
        {
            "metric": signal["metric"],
            "recent_window": signal["window"],
            "baseline_window": signal["baseline_window"],
            "recent_value": signal["recent"],
            "baseline_value": signal["baseline"],
            "delta": signal["delta"],
        }
        for signal in signals
    ]
    return {
        "record_count": len(dated),
        "anchor_date": anchor.date().isoformat(),
        "date_range": {
            "latest": dated[0][0].isoformat(),
            "earliest": dated[-1][0].isoformat(),
        },
        "windows": summaries,
        "personal_baseline": summaries["30d"],
        "longest_consecutive_warning_days": _consecutive_warning_days(dated),
        "change_signals": signals,
        "combined_signals": combined,
        "evidence": evidence,
    }
