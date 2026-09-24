from __future__ import annotations

import unittest

from helpers_v02 import (
    HUMAN_LABEL_GATE_STATUS,
    POLICY_VERSION,
    calculate_depth_raw,
    decide,
    extract_features,
    score_pair,
)


class HelpersV02Tests(unittest.TestCase):
    def test_version_and_waiver_state(self) -> None:
        self.assertEqual(POLICY_VERSION, "local-v0.2")
        self.assertEqual(HUMAN_LABEL_GATE_STATUS, "WAIVED_BY_FOUNDER_NOT_PERFORMED")

    def test_penalty_changes_formula_only_when_present(self) -> None:
        base = {
            "relevance_score": 0.8,
            "specificity_score": 0.7,
            "semantic_density": 0.6,
            "structure_score": 0.5,
            "lexical_diversity": 0.9,
            "emotional_concreteness": 0.4,
            "repeat_pattern_penalty": 0.1,
            "emoji_symbol_penalty": 0.2,
            "spam_signature_penalty": 0.0,
        }
        self.assertEqual(calculate_depth_raw(base), 0.625)
        self.assertEqual(calculate_depth_raw({**base, "ungrounded_abstract_penalty": 0.5}), 0.525)

    def test_contact_solicitation_is_rejected(self) -> None:
        features = extract_features(
            "주말에 가장 하고 싶은 것은?",
            "답장 주면 연락해요. 카톡 추가해요.",
            [1.0, 0.0],
            [0.95, 0.05],
        )
        self.assertGreaterEqual(features["spam_signature_penalty"], 0.65)
        decision = decide(0.9, 30, features)
        self.assertEqual(decision.verdict, "REJECT")
        self.assertEqual(decision.path, "SPAM_REJECT")

    def test_ungrounded_abstract_high_score_is_reviewed(self) -> None:
        features = extract_features(
            "요즘 가장 중요한 것은?",
            "본질적인 관계 구조와 문화적 정체성은 상호 수용의 과정에서 성장의 토대가 됩니다.",
            [1.0, 0.0],
            [0.95, 0.05],
        )
        self.assertGreaterEqual(features["ungrounded_abstract_penalty"], 0.55)
        self.assertGreaterEqual(features["abstract_style_hits"], 2)
        decision = decide(0.75, int(features["answer_length"]), features)
        self.assertEqual(decision.verdict, "REVIEW")
        self.assertEqual(decision.reason_codes, ["UNGROUNDED_ABSTRACT_REVIEW"])

    def test_repeated_abstract_cues_with_weak_grounding_review_even_below_score_threshold(self) -> None:
        decision = decide(
            0.20,
            60,
            {
                "spam_signature_penalty": 0.0,
                "repeat_pattern_penalty": 0.0,
                "emoji_symbol_penalty": 0.0,
                "ungrounded_abstract_penalty": 0.30,
                "abstract_style_hits": 2,
                "personal_grounding_score": 0.20,
            },
        )
        self.assertEqual(decision.verdict, "REVIEW")
        self.assertEqual(decision.reason_codes, ["UNGROUNDED_ABSTRACT_REVIEW"])

    def test_abstract_cues_with_concrete_personal_grounding_do_not_force_review(self) -> None:
        decision = decide(
            0.60,
            60,
            {
                "spam_signature_penalty": 0.0,
                "repeat_pattern_penalty": 0.0,
                "emoji_symbol_penalty": 0.0,
                "ungrounded_abstract_penalty": 0.20,
                "abstract_style_hits": 2,
                "personal_grounding_score": 0.60,
                "specificity_score": 0.60,
                "emotional_concreteness": 0.45,
            },
        )
        self.assertEqual(decision.verdict, "PASS")

    def test_onboarding_is_product_bypass_not_a_depth_score_claim(self) -> None:
        result = score_pair(
            "하나만 고른다면?",
            "치킨",
            [1.0, 0.0],
            [0.1, 0.9],
            product_context="ONBOARDING",
        )
        self.assertEqual(result["verdict"], "PASS")
        self.assertEqual(result["path"], "ONBOARDING_PASS")
        self.assertEqual(result["reason_codes"], ["ONBOARDING_BYPASS"])
        self.assertEqual(result["policy_version"], POLICY_VERSION)


if __name__ == "__main__":
    unittest.main()
