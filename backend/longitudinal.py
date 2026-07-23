from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from statistics import mean
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
    return {
        "records": len(rows),
        **{f"avg_{metric}": _average(rows, metric) for metric in METRICS},
        "state_counts": dict(states),
        "dominant_state": states.most_common(1)[0][0] if states else "unknown",
    }


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
        "change_signals": signals,
        "combined_signals": combined,
        "evidence": evidence,
    }
