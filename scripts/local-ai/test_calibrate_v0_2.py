from __future__ import annotations

import unittest

from calibrate_v0_2 import build_threshold_sweep, summarize_policy


class CalibrationSummaryTests(unittest.TestCase):
    def test_summary_never_calls_synthetic_prior_accuracy(self) -> None:
        rows = [
            {"category": "AI_STYLED", "synthetic_label": "REVIEW", "verdict": "REVIEW", "path": "GRAY_BAND"},
            {"category": "SPAM_ABUSE", "synthetic_label": "REJECT", "verdict": "REJECT", "path": "SPAM_REJECT"},
            {"category": "ONBOARDING", "synthetic_label": "PASS", "verdict": "PASS", "path": "ONBOARDING_PASS"},
        ]
        out = summarize_policy(rows)
        self.assertTrue(out["policy_candidate"])
        self.assertNotIn("accuracy", out)

    def test_threshold_sweep_preserves_onboarding_bypass(self) -> None:
        base = [
            {
                "category": "ONBOARDING",
                "synthetic_label": "PASS",
                "score": 0.01,
                "verdict": "PASS",
                "path": "ONBOARDING_PASS",
                "features": {"answer_length": 2},
            },
            {
                "category": "L1_PASS",
                "synthetic_label": "PASS",
                "score": 0.60,
                "verdict": "PASS",
                "path": "FAST_TRACK",
                "features": {
                    "answer_length": 20,
                    "spam_signature_penalty": 0.0,
                    "repeat_pattern_penalty": 0.0,
                    "emoji_symbol_penalty": 0.0,
                    "ungrounded_abstract_penalty": 0.0,
                },
            },
        ]
        sweep = build_threshold_sweep(base)
        for item in sweep.values():
            self.assertEqual(item["verdict_counts"]["PASS"], 2)


if __name__ == "__main__":
    unittest.main()
