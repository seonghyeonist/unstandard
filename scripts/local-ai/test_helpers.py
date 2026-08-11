"""Offline unit tests for scripts/local-ai/helpers.py (no model, no workbook)."""

from __future__ import annotations

import math
import tempfile
import unittest
from pathlib import Path

from helpers import (
    APPROVED_SNAPSHOT_ID,
    EXPECTED_WORKBOOK_SHA256,
    HUMAN_LABEL_GATE_STATUS,
    METRIC_AGREEMENT,
    QWEN_STATUS,
    HashMismatchError,
    agreement_with_synthetic_prior,
    ascii_space_removed_length,
    calculate_depth_raw,
    clamp,
    cosine_similarity,
    decide,
    embedding_health,
    normalize_pair_key,
    percentile,
    score_pair,
    sha256_file,
    threshold_band,
    verify_workbook_hash,
)


class HelperTests(unittest.TestCase):
    def test_ascii_space_removed_length(self) -> None:
        self.assertEqual(ascii_space_removed_length("a b c"), 3)
        self.assertEqual(ascii_space_removed_length("ab"), 2)
        # Non-ASCII whitespace is not removed by the governing definition.
        self.assertEqual(ascii_space_removed_length("a\tb"), 3)

    def test_normalize_pair_key_is_whitespace_insensitive(self) -> None:
        a = normalize_pair_key("hello  world", "answer")
        b = normalize_pair_key("hello world", "answer")
        self.assertEqual(a, b)
        self.assertNotEqual(a, normalize_pair_key("hello world", "other"))

    def test_sha256_and_verify(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "blob.bin"
            path.write_bytes(b"unstandard-poc")
            digest = sha256_file(str(path))
            self.assertEqual(len(digest), 64)
            with self.assertRaises(HashMismatchError):
                verify_workbook_hash(str(path), EXPECTED_WORKBOOK_SHA256)

    def test_depth_formula_weights(self) -> None:
        features = {
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
        self.assertEqual(calculate_depth_raw(features), 0.625)
        self.assertEqual(clamp(calculate_depth_raw(features), 0.0, 1.0), 0.625)

    def test_decide_paths(self) -> None:
        fast = decide(
            0.56,
            8,
            {
                "spam_signature_penalty": 0.0,
                "specificity_score": 0.6,
                "emotional_concreteness": 0.4,
            },
        )
        self.assertEqual(fast.verdict, "PASS")
        self.assertEqual(fast.path, "FAST_TRACK")

        gray = decide(
            0.39,
            30,
            {
                "spam_signature_penalty": 0.0,
                "specificity_score": 0.4,
                "emotional_concreteness": 0.1,
            },
        )
        self.assertEqual(gray.verdict, "REVIEW")
        self.assertEqual(gray.path, "GRAY_BAND")

        spam = decide(
            0.95,
            100,
            {
                "spam_signature_penalty": 0.9,
                "specificity_score": 0.9,
                "emotional_concreteness": 0.9,
            },
        )
        self.assertEqual(spam.verdict, "REJECT")
        self.assertEqual(spam.path, "SPAM_REJECT")

    def test_cosine_and_score_pair_omit_raw_text(self) -> None:
        self.assertTrue(math.isclose(cosine_similarity([1.0, 0.0], [1.0, 0.0]), 1.0))
        result = score_pair(
            "q",
            "퇴근길에 같은 가로수를 보면 이상하게 하루가 덜 망한 것 같아요.",
            [1.0, 0.0, 0.0],
            [0.9, 0.1, 0.0],
        )
        self.assertIn(result["verdict"], {"PASS", "REVIEW", "REJECT"})
        self.assertNotIn("question", result)
        self.assertNotIn("answer", result)
        self.assertNotIn("answer_text", result["features"])

    def test_agreement_metric_name(self) -> None:
        out = agreement_with_synthetic_prior(["PASS", "REJECT"], ["PASS", "PASS"])
        self.assertEqual(out["metric"], METRIC_AGREEMENT)
        self.assertEqual(out["agreements"], 1)
        self.assertEqual(out["disagreements"], 1)
        self.assertNotIn("accuracy", out)
        self.assertNotIn("ground_truth", out)

    def test_percentile_and_bands(self) -> None:
        values = [0.1, 0.2, 0.3, 0.4, 0.5]
        self.assertEqual(percentile(values, 0), 0.1)
        self.assertEqual(percentile(values, 100), 0.5)
        self.assertEqual(threshold_band(0.38), "in_gray_band")
        self.assertEqual(threshold_band(0.20), "below_gray")
        self.assertEqual(threshold_band(0.50), "above_threshold_below_fast_track")
        self.assertEqual(threshold_band(0.60), "fast_track_or_above")

    def test_embedding_health(self) -> None:
        health = embedding_health([[0.0] * 1024, [1.0] * 1024])
        self.assertTrue(health["dim_ok"])
        self.assertEqual(health["nan_count"], 0)
        bad = embedding_health([[float("nan")] * 3])
        self.assertFalse(bad["dim_ok"])
        self.assertEqual(bad["nan_count"], 3)

    def test_gate_constants(self) -> None:
        self.assertEqual(HUMAN_LABEL_GATE_STATUS, "NOT_RUN_FOUNDER_DEFERRED")
        self.assertEqual(QWEN_STATUS, "INACTIVE_NOT_INSTALLED")
        self.assertEqual(APPROVED_SNAPSHOT_ID, "ULDS-v0.1-b63f77dc-20260804")
        self.assertEqual(
            EXPECTED_WORKBOOK_SHA256,
            "b63f77dc7fa10694e4af6d3fc5ee86c4fcb4b01bda0889a1e96bcba4b1a55e51",
        )


if __name__ == "__main__":
    unittest.main()
