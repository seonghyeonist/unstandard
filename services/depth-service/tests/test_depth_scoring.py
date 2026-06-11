from __future__ import annotations

from app.config import RuntimeConfig
from app.decision import decide
from app.features import calculate_depth_raw, clamp, extract_features
from app.models import DecisionPath, Verdict


def test_depth_formula_matches_v4_2_weights() -> None:
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

    assert calculate_depth_raw(features) == 0.625
    assert clamp(calculate_depth_raw(features), 0.0, 1.0) == 0.625


def test_fast_track_precedes_basic_threshold() -> None:
    decision = decide(
        depth_score=0.56,
        answer_length=8,
        features={
            "spam_signature_penalty": 0.0,
            "specificity_score": 0.6,
            "emotional_concreteness": 0.4,
        },
        config=RuntimeConfig(),
    )

    assert decision.verdict == Verdict.PASS
    assert decision.path == DecisionPath.FAST_TRACK
    assert "FAST_TRACK_SCORE" in decision.reason_codes


def test_gray_band_routes_to_review() -> None:
    decision = decide(
        depth_score=0.39,
        answer_length=30,
        features={
            "spam_signature_penalty": 0.0,
            "specificity_score": 0.4,
            "emotional_concreteness": 0.1,
        },
        config=RuntimeConfig(depth_score_threshold=0.38, depth_gray_band=0.03),
    )

    assert decision.verdict == Verdict.REVIEW
    assert decision.path == DecisionPath.GRAY_BAND


def test_spam_reject_short_circuits_decision() -> None:
    decision = decide(
        depth_score=0.95,
        answer_length=100,
        features={
            "spam_signature_penalty": 0.9,
            "specificity_score": 0.9,
            "emotional_concreteness": 0.9,
        },
        config=RuntimeConfig(),
    )

    assert decision.verdict == Verdict.REJECT
    assert decision.path == DecisionPath.SPAM_REJECT
    assert decision.reason_codes == ["SPAM_SIGNATURE"]


def test_feature_extractor_keeps_raw_text_out_of_snapshot() -> None:
    result = extract_features(
        "요즘 당신을 웃게 만드는 것은?",
        "퇴근길에 같은 가로수를 보면 이상하게 하루가 덜 망한 것 같아요.",
        [1.0, 0.0, 0.0],
        [0.9, 0.1, 0.0],
    )

    assert "answer_text" not in result.features
    assert result.features["relevance_score"] > 0.8
    assert result.features["answer_length"] >= 8

