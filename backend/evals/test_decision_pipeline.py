from __future__ import annotations

import unittest

from backend.decision_pipeline import assess_turn, plan_response
from backend.longitudinal import build_longitudinal_state, extract_dialogue_signals
from backend.retriever import LocalRetriever


class DecisionPipelineTests(unittest.TestCase):
    def test_medication_question_requires_authority_a(self) -> None:
        assessment = assess_turn(
            "副作用很难受，我今晚能不能先停药？",
            {"risk_level": "low", "evidence": []},
            {"state": "unknown", "confidence": 0.4, "evidence": [], "conflict": False},
            {"change_signals": [], "combined_signals": []},
        )
        self.assertEqual(assessment.user_need, "medication_question")
        self.assertEqual(assessment.topic, "medication_boundary")
        self.assertTrue(assessment.needs_medical_facts)

        results = LocalRetriever(api_key=None).search(
            "副作用很难受，我今晚能不能先停药？",
            topic=assessment.topic,
            medical_fact_required=True,
        )
        self.assertTrue(results)
        self.assertTrue(all(item["metadata"]["authority_level"] == "A" for item in results))

    def test_medium_manic_plan_prioritizes_deescalation(self) -> None:
        assessment = assess_turn(
            "我两天没睡，还想马上花很多钱",
            {"risk_level": "medium", "evidence": ["sleep loss"]},
            {"state": "manic", "confidence": 0.9, "evidence": ["elevated"], "conflict": False},
            {"change_signals": [], "combined_signals": []},
        )
        plan = plan_response(assessment, [])
        self.assertIn("延迟重大决定", plan.strategies)
        self.assertLessEqual(plan.max_questions, 1)


class LongitudinalStateTests(unittest.TestCase):
    def test_real_date_windows_and_combined_signal(self) -> None:
        logs = [
            {"created_at": "2026-07-23", "mood": 3, "sleep": 1, "energy": 5, "impulse": 5, "state": "manic"},
            {"created_at": "2026-07-22", "mood": 3, "sleep": 1, "energy": 5, "impulse": 5, "state": "manic"},
            {"created_at": "2026-07-15", "mood": 3, "sleep": 4, "energy": 2, "impulse": 1, "state": "stable"},
            {"created_at": "2026-07-08", "mood": 3, "sleep": 4, "energy": 2, "impulse": 1, "state": "stable"},
            {"created_at": "2026-06-01", "mood": 3, "sleep": 5, "energy": 2, "impulse": 1, "state": "stable"},
        ]
        result = build_longitudinal_state(logs)
        self.assertEqual(result["windows"]["3d"]["records"], 2)
        self.assertEqual(result["windows"]["30d"]["records"], 4)
        changed = {item["metric"] for item in result["change_signals"]}
        self.assertTrue({"sleep", "energy", "impulse"}.issubset(changed))
        self.assertTrue(result["combined_signals"])
        self.assertEqual(result["windows"]["3d"]["median_sleep"], 1.0)
        self.assertEqual(result["windows"]["3d"]["range_energy"], [5.0, 5.0])
        self.assertIn("source_dates", result["change_signals"][0])
        self.assertGreaterEqual(result["longest_consecutive_warning_days"], 2)

    def test_insufficient_records_do_not_invent_trend(self) -> None:
        result = build_longitudinal_state(
            [{"created_at": "2026-07-23", "mood": 2, "sleep": 1, "energy": 5, "impulse": 4, "state": "mixed"}]
        )
        self.assertEqual(result["change_signals"], [])
        self.assertEqual(result["combined_signals"], [])

    def test_explicit_dialogue_signals_are_structured_without_guessing(self) -> None:
        signals = extract_dialogue_signals(["我这三天每天只睡 2 小时，但精力特别高，还想冲动花钱"])
        metrics = {item.get("metric") or item.get("signal") for item in signals}
        self.assertIn("sleep_hours", metrics)
        self.assertIn("increased_energy", metrics)
        self.assertIn("increased_impulsivity", metrics)


if __name__ == "__main__":
    unittest.main()
