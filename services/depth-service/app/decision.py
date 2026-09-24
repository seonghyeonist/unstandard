from __future__ import annotations

from app.config import RuntimeConfig
from app.models import Decision, DecisionPath, Verdict


def decide(depth_score: float, answer_length: int, features: dict, config: RuntimeConfig) -> Decision:
    reason_codes: list[str] = []

    if features.get("spam_signature_penalty", 0.0) >= 0.65:
        return Decision(
            verdict=Verdict.REJECT,
            path=DecisionPath.SPAM_REJECT,
            reason_codes=["SPAM_SIGNATURE"],
        )

    if features.get("repeat_pattern_penalty", 0.0) >= 0.70:
        return Decision(
            verdict=Verdict.REJECT,
            path=DecisionPath.SPAM_REJECT,
            reason_codes=["REPEAT_DOMINANT"],
        )

    if features.get("emoji_symbol_penalty", 0.0) >= 0.75:
        return Decision(
            verdict=Verdict.REJECT,
            path=DecisionPath.SPAM_REJECT,
            reason_codes=["SYMBOL_DOMINANT"],
        )

    # v0.2 safety valve: a polished/abstract answer that scores well but lacks
    # concrete personal grounding is reviewed rather than auto-unlocked.
    if (
        depth_score >= config.depth_score_threshold
        and features.get("ungrounded_abstract_penalty", 0.0) >= 0.55
    ):
        return Decision(
            verdict=Verdict.REVIEW,
            path=DecisionPath.GRAY_BAND,
            reason_codes=["UNGROUNDED_ABSTRACT_REVIEW"],
        )

    if depth_score >= config.fast_track_threshold and answer_length >= config.fast_track_min_length:
        reason_codes.append("FAST_TRACK_SCORE")
        if features.get("specificity_score", 0.0) >= 0.55:
            reason_codes.append("SPECIFIC")
        if features.get("emotional_concreteness", 0.0) >= 0.35:
            reason_codes.append("EMOTIONAL_CONCRETE")
        if features.get("personal_grounding_score", 0.0) >= 0.45:
            reason_codes.append("PERSONALLY_GROUNDED")
        return Decision(verdict=Verdict.PASS, path=DecisionPath.FAST_TRACK, reason_codes=reason_codes)

    if abs(depth_score - config.depth_score_threshold) <= config.depth_gray_band:
        return Decision(
            verdict=Verdict.REVIEW,
            path=DecisionPath.GRAY_BAND,
            reason_codes=["GRAY_BAND"],
        )

    if depth_score >= config.depth_score_threshold and answer_length >= config.min_answer_length:
        return Decision(verdict=Verdict.PASS, path=DecisionPath.BASIC, reason_codes=["BASIC_SCORE"])

    if answer_length < config.fast_track_min_length:
        reason_codes.append("TOO_SHORT")
    if depth_score < config.depth_score_threshold:
        reason_codes.append("LOW_SCORE")
    return Decision(verdict=Verdict.REJECT, path=DecisionPath.LOW_SCORE, reason_codes=reason_codes)
