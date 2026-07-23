from __future__ import annotations

import unittest

from backend.prompting import FEW_SHOT_EXAMPLES, SYSTEM_PROMPT


class PromptingFewShotTests(unittest.TestCase):
    def test_few_shot_examples_are_in_system_prompt(self) -> None:
        self.assertIn(FEW_SHOT_EXAMPLES, SYSTEM_PROMPT)
        self.assertIn("我昨晚只睡了两个小时", SYSTEM_PROMPT)
        self.assertIn("我现在不想听建议", SYSTEM_PROMPT)

    def test_manic_example_models_delay_and_support_without_diagnosis(self) -> None:
        self.assertIn("延后 24 小时", FEW_SHOT_EXAMPLES)
        self.assertIn("暂时停止新的付款或承诺", FEW_SHOT_EXAMPLES)
        self.assertIn("信任、了解你平时状态的人", FEW_SHOT_EXAMPLES)
        self.assertNotIn("你正处于躁狂", FEW_SHOT_EXAMPLES)

    def test_depressed_example_respects_no_advice_boundary(self) -> None:
        self.assertIn("我先不催你做什么", FEW_SHOT_EXAMPLES)
        self.assertIn("我会先在这里陪着你", FEW_SHOT_EXAMPLES)
        self.assertNotIn("你应该振作", FEW_SHOT_EXAMPLES)


if __name__ == "__main__":
    unittest.main()
