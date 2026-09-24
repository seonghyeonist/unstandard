from __future__ import annotations

import unittest

from calibrate_v0_2 import (
    build_threshold_sweep,
    build_ungrounded_review_threshold_sweep,
    summarize_policy,
    summarize_scores,
)


class CalibrationSummaryTests(unittest.TestCase):
    def test_summary_uses_synthetic_prior_proxy_language(self) -> None:
        rows = [
            {"category": "AI_STYLED", "synthetic_label": "REVIEW", "verdict": "REVIEW", "path": "GRAY_BAND", "score": 0.38},
            {"category": "SPAM_ABUSE", "synthetic_label": "REJECT", "verdict": "REJECT", "path": "SPAM_REJECT", "score": 0.2},
            {"category": "ONBOARDING", "synthetic_label": "PASS", "verdict": "PASS", "path": "ONBOARDING_PASS", "score": 0.01},
        ]
        out = summarize_policy(rows)
        self.assertTrue(out["policy_candidate"])
        self.assertEqual(out["score_distribution"]["n"], 3)
        self.assertEqual(out["threshold_band_counts"]["in_gray_band"], 1)
        self.assertEqual(out["all_scored_threshold_band_counts"]["below_gray"], 2)
        self.assertEqual(out["overall"]["metric"], "agreement_with_synthetic_prior")
        self.assertIn("offline label-disagreement proxy", out["overall"]["note"])
        self.assertNotIn("accuracy", str(out).lower())
        self.assertNotIn("ground truth", str(out).lower())

    def test_score_distribution_is_aggregate_only(self) -> None:
        out = summarize_scores([0.2, 0.4, 0.6, 0.8])
        self.assertEqual(out["n"], 4)
        self.assertEqual(out["mean"], 0.5)
        self.assertEqual(out["min"], 0.2)
        self.assertEqual(out["max"], 0.8)

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
            self.assertEqual(item["score_distribution"]["n"], 2)
            self.assertIn("threshold_band_counts", item)
        self.assertEqual(set(sweep), {"0.35", "0.38", "0.40", "0.45"})

    def test_ungrounded_review_threshold_sweep_keeps_spam_and_onboarding_rules(self) -> None:
        rows = [
            {"category": "AI_STYLED", "synthetic_label": "REVIEW", "score": 0.5, "features": {"answer_length": 40, "ungrounded_abstract_penalty": 0.5}},
            {"category": "L3_PASS", "synthetic_label": "PASS", "score": 0.6, "features": {"answer_length": 40, "ungrounded_abstract_penalty": 0.3}},
            {"category": "SPAM_ABUSE", "synthetic_label": "REJECT", "score": 0.9, "features": {"answer_length": 40, "ungrounded_abstract_penalty": 0.0, "spam_signature_penalty": 0.9}},
            {"category": "ONBOARDING", "synthetic_label": "PASS", "score": 0.0, "features": {"answer_length": 2}},
        ]
        sweep = build_ungrounded_review_threshold_sweep(rows)
        self.assertEqual(sweep["0.45"]["critical_category_rates"]["ai_styled_review_rate"], 1.0)
        self.assertEqual(sweep["0.45"]["critical_category_rates"]["spam_abuse_reject_rate"], 1.0)
        self.assertEqual(sweep["0.45"]["critical_category_rates"]["onboarding_pass_rate"], 1.0)
        self.assertEqual(sweep["0.55"]["critical_category_rates"]["ai_styled_review_rate"], 0.0)


if __name__ == "__main__":
    unittest.main()
