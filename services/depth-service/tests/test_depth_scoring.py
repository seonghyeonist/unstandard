from __future__ import annotations

from app.config import RuntimeConfig
from app.decision import decide
from app.features import calculate_depth_raw, clamp, extract_features
from app.models import DecisionPath, Verdict


def test_depth_formula_matches_v4_2_weights_without_v02_penalty() -> None:
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


def test_v02_ungrounded_abstract_penalty_reduces_raw_score() -> None:
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
        "ungrounded_abstract_penalty": 0.5,
    }
    assert calculate_depth_raw(features) == 0.525


def test_fast_track_precedes_basic_threshold() -> None:
    decision = decide(
        depth_score=0.56,
        answer_length=8,
        features={
            "spam_signature_penalty": 0.0,
            "repeat_pattern_penalty": 0.0,
            "emoji_symbol_penalty": 0.0,
            "ungrounded_abstract_penalty": 0.0,
            "specificity_score": 0.6,
            "emotional_concreteness": 0.4,
            "personal_grounding_score": 0.5,
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
            "repeat_pattern_penalty": 0.0,
            "emoji_symbol_penalty": 0.0,
            "ungrounded_abstract_penalty": 0.0,
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


def test_repeat_dominant_rejects_even_if_score_is_high() -> None:
    decision = decide(
        depth_score=0.85,
        answer_length=20,
        features={"repeat_pattern_penalty": 0.9, "spam_signature_penalty": 0.0},
        config=RuntimeConfig(),
    )
    assert decision.verdict == Verdict.REJECT
    assert decision.reason_codes == ["REPEAT_DOMINANT"]


def test_polished_but_ungrounded_high_score_is_reviewed() -> None:
    decision = decide(
        depth_score=0.72,
        answer_length=48,
        features={
            "spam_signature_penalty": 0.0,
            "repeat_pattern_penalty": 0.0,
            "emoji_symbol_penalty": 0.0,
            "ungrounded_abstract_penalty": 0.72,
            "specificity_score": 0.25,
            "emotional_concreteness": 0.20,
        },
        config=RuntimeConfig(),
    )
    assert decision.verdict == Verdict.REVIEW
    assert decision.path == DecisionPath.GRAY_BAND
    assert decision.reason_codes == ["UNGROUNDED_ABSTRACT_REVIEW"]


def test_v02_abstract_review_uses_lower_calibrated_cutoff() -> None:
    decision = decide(
        depth_score=0.72,
        answer_length=48,
        features={
            "spam_signature_penalty": 0.0,
            "repeat_pattern_penalty": 0.0,
            "emoji_symbol_penalty": 0.0,
            "ungrounded_abstract_penalty": 0.50,
        },
        config=RuntimeConfig(),
    )
    assert decision.verdict == Verdict.REVIEW
    assert decision.reason_codes == ["UNGROUNDED_ABSTRACT_REVIEW"]


def test_repeated_abstract_cues_need_personal_grounding_before_pass() -> None:
    decision = decide(
        depth_score=0.20,
        answer_length=60,
        features={
            "spam_signature_penalty": 0.0,
            "repeat_pattern_penalty": 0.0,
            "emoji_symbol_penalty": 0.0,
            "ungrounded_abstract_penalty": 0.30,
            "abstract_style_hits": 2,
            "personal_grounding_score": 0.20,
        },
        config=RuntimeConfig(),
    )
    assert decision.verdict == Verdict.REVIEW
    assert decision.reason_codes == ["UNGROUNDED_ABSTRACT_REVIEW"]


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
    assert result.features["personal_grounding_score"] > 0.0


def test_feature_extractor_flags_contact_solicitation() -> None:
    result = extract_features(
        "주말에 가장 하고 싶은 것은?",
        "답장 주면 연락해요. 카톡 추가해요.",
        [1.0, 0.0, 0.0],
        [0.9, 0.1, 0.0],
    )
    assert result.features["spam_signature_penalty"] >= 0.65
    assert "SPAM_SIGNATURE" in result.reason_codes


def test_feature_extractor_flags_ungrounded_abstract_style_without_raw_text_rule() -> None:
    result = extract_features(
        "요즘 가장 중요한 것은?",
        "본질적인 관계 구조와 문화적 정체성은 상호 수용의 과정에서 성장의 토대가 됩니다.",
        [1.0, 0.0, 0.0],
        [0.95, 0.05, 0.0],
    )
    assert result.features["ungrounded_abstract_penalty"] >= 0.45
    assert result.features["personal_grounding_score"] < 0.45
    assert "UNGROUNDED_ABSTRACT" in result.reason_codes


def test_runtime_version_is_v02() -> None:
    assert RuntimeConfig().depth_model_version == "local-v0.2"
