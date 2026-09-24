"""Pure Local AI v0.2 policy helpers.

No network, no model load, no workbook I/O. This module is intentionally separate
from helpers.py so the 2026-08-04 v0.1 technical-PoC evidence remains reproducible.
Raw question/answer text must never be emitted by callers.
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

EXPECTED_WORKBOOK_SHA256 = (
    "b63f77dc7fa10694e4af6d3fc5ee86c4fcb4b01bda0889a1e96bcba4b1a55e51"
)
APPROVED_SNAPSHOT_ID = "ULDS-v0.1-b63f77dc-20260804"
EXPECTED_PHYSICAL_ROWS = 1000
EXPECTED_UNIQUE_PAIRS = 260

MIN_ANSWER_LENGTH = 12
FAST_TRACK_MIN_LENGTH = 8
FAST_TRACK_THRESHOLD = 0.55
DEPTH_SCORE_THRESHOLD = 0.38
DEPTH_GRAY_BAND = 0.03
UNGROUNDED_ABSTRACT_REVIEW_THRESHOLD = 0.45
ABSTRACT_STYLE_REVIEW_MIN_HITS = 2
MAX_PERSONAL_GROUNDING_FOR_ABSTRACT_REVIEW = 0.45
EXPECTED_EMBEDDING_DIM = 1024
POLICY_VERSION = "local-v0.2"
HUMAN_LABEL_GATE_STATUS = "WAIVED_BY_FOUNDER_NOT_PERFORMED"
QWEN_STATUS = "INACTIVE_NOT_INSTALLED"
METRIC_AGREEMENT = "agreement_with_synthetic_prior"
MODEL_ID = "BAAI/bge-m3"
LOCAL_AI_ROOT = "/tmp/unstandard-local-ai"

TOKEN_RE = re.compile(r"[A-Za-z0-9가-힣]+")
URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:\+?82[-.\s]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}")
REPEATED_CHAR_RE = re.compile(r"(.)\1{4,}")
EMOJI_RE = re.compile(
    "["
    "\U0001f300-\U0001f5ff"
    "\U0001f600-\U0001f64f"
    "\U0001f680-\U0001f6ff"
    "\U0001f700-\U0001f77f"
    "\U0001f780-\U0001f7ff"
    "\U0001f800-\U0001f8ff"
    "\U0001f900-\U0001f9ff"
    "\U0001fa00-\U0001fa6f"
    "\U0001fa70-\U0001faff"
    "]+",
)

FIRST_PERSON = {"나", "저", "제가", "나는", "저는", "내가", "제", "내"}
TIME_HINTS = {"오늘", "어제", "요즘", "주말", "퇴근", "아침", "점심", "저녁", "밤", "작년", "최근", "가끔", "매일"}
PLACE_HINTS = {"집", "회사", "학교", "카페", "길", "공원", "버스", "지하철", "동네", "방", "역", "골목", "가게"}
EMOTION_HINTS = {
    "좋", "싫", "기쁘", "슬프", "웃", "편안", "불안", "무섭", "설레", "외롭", "고맙",
    "행복", "화", "미안", "아쉽", "부끄", "든든", "상처", "위로", "그립", "벅차", "뭉클",
}
VALUE_HINTS = {"가치", "관계", "취향", "선호", "소중", "중요", "믿", "존중", "배려", "진심"}
EVASIVE = {"몰라", "글쎄", "없음", "없어요", "아무거나", "그냥", "딱히", "ㅎㅎ", "ㅋㅋ"}
SPAM_TERMS = {
    "카톡", "카카오", "오픈채팅", "텔레그램", "라인", "투자", "수익", "바카라", "토토",
    "성인", "조건만남", "만남보장", "무료", "이벤트", "링크", "프로필확인",
}
CONTACT_SOLICITATION_HINTS = {
    "연락", "답장", "추가해", "추가해요", "아이디", "dm", "디엠", "인스타", "오픈채팅",
    "카톡", "카카오", "텔레그램", "라인",
}
SELF_PROMO_HINTS = {
    "잘 부탁", "기회 주세요", "기회주세요", "좋은 사람이", "괜찮은 사람이", "재미있는 사람이",
    "믿어요", "믿어주세요", "안녕하세요 저는",
}
MISMATCH_HINTS = {"질문이랑 상관없는", "질문과 상관없는", "질문은 모르겠고", "상관없는 얘기"}
ABSTRACT_STYLE_HINTS = {
    "본질", "구조", "정체성", "매개", "상호", "취약성", "진정성", "핵심", "효율적",
    "자기계발", "가치관", "토대", "과정", "성장", "문화적", "감정적", "인지", "수용",
    "추구", "의미 있는 선택", "장기적 관계", "세계관", "메타포", "언행일치",
}


@dataclass(frozen=True)
class Decision:
    verdict: str
    path: str
    reason_codes: list[str]


class HashMismatchError(Exception):
    def __init__(self, observed: str) -> None:
        self.observed = observed
        super().__init__("BLOCKED_INPUT_HASH_MISMATCH")


def clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def ascii_space_removed_length(text: str) -> int:
    return len(text.replace(" ", ""))


def normalize_pair_key(question: str, answer: str) -> str:
    q = "".join(unicodedata.normalize("NFKC", question).split())
    a = "".join(unicodedata.normalize("NFKC", answer).split())
    return hashlib.sha256(f"{q}\n{a}".encode("utf-8")).hexdigest()


def sha256_file(path: str, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        while True:
            chunk = handle.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def verify_workbook_hash(path: str, expected: str = EXPECTED_WORKBOOK_SHA256) -> str:
    observed = sha256_file(path)
    if observed != expected:
        raise HashMismatchError(observed)
    return observed


def tokenize(text: str) -> list[str]:
    return [match.group(0).lower() for match in TOKEN_RE.finditer(text)]


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right) or not left:
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return dot / (left_norm * right_norm)


def calculate_depth_raw(features: Mapping[str, Any]) -> float:
    return (
        (0.30 * float(features["relevance_score"]))
        + (0.25 * float(features["specificity_score"]))
        + (0.15 * float(features["semantic_density"]))
        + (0.10 * float(features["structure_score"]))
        + (0.10 * float(features["lexical_diversity"]))
        + (0.10 * float(features["emotional_concreteness"]))
        - (0.20 * float(features["repeat_pattern_penalty"]))
        - (0.20 * float(features["emoji_symbol_penalty"]))
        - (0.30 * float(features["spam_signature_penalty"]))
        - (0.20 * float(features.get("ungrounded_abstract_penalty", 0.0)))
    )


def extract_features(
    question_text: str,
    answer_text: str,
    question_embedding: Sequence[float],
    answer_embedding: Sequence[float],
) -> dict[str, Any]:
    tokens = tokenize(answer_text)
    question_tokens = set(tokenize(question_text))
    token_count = len(tokens)
    unique_count = len(set(tokens))
    text_len = len(answer_text.strip())
    lower_text = answer_text.lower()

    cosine = cosine_similarity(question_embedding, answer_embedding)
    lexical_overlap = len(question_tokens.intersection(tokens)) / max(1, len(question_tokens))
    relevance_score = clamp((cosine + 1.0) / 2.0 * 0.85 + lexical_overlap * 0.15)

    first_person_hits = sum(1 for token in tokens if token in FIRST_PERSON)
    time_hits = _substring_hits(lower_text, TIME_HINTS)
    place_hits = _substring_hits(lower_text, PLACE_HINTS)
    numeric_hits = min(2, len(re.findall(r"\d+", answer_text)))
    long_content_bonus = min(2, sum(1 for token in set(tokens) if len(token) >= 4)) * 0.04
    specificity_score = clamp(
        (min(first_person_hits, 2) * 0.18)
        + (min(time_hits, 2) * 0.16)
        + (min(place_hits, 2) * 0.16)
        + (numeric_hits * 0.10)
        + (min(text_len, 80) / 320)
        + long_content_bonus
    )

    emotion_hits = _substring_hits(lower_text, EMOTION_HINTS)
    value_hits = _substring_hits(lower_text, VALUE_HINTS)
    situational_hits = min(4, time_hits + place_hits + numeric_hits)
    semantic_density = clamp(
        ((first_person_hits + situational_hits + emotion_hits + value_hits) / max(5, token_count * 0.65)) * 1.7
        + min(text_len, 60) / 600
    )
    emotional_concreteness = clamp(
        (min(emotion_hits, 3) * 0.22)
        + (min(value_hits, 2) * 0.12)
        + (min(situational_hits, 3) * 0.14)
    )
    personal_grounding_score = clamp(
        (min(first_person_hits, 2) * 0.30)
        + (min(time_hits, 2) * 0.18)
        + (min(place_hits, 2) * 0.18)
        + (numeric_hits * 0.12)
        + (min(lexical_overlap, 0.50) * 0.24)
    )

    sentence_count = max(1, len(re.findall(r"[.!?。！？]|요\b|다\b", answer_text)))
    evasive_hits = sum(1 for word in EVASIVE if word in lower_text)
    structure_score = clamp(
        0.35 + min(sentence_count, 3) * 0.18 + min(text_len, 80) / 220 - evasive_hits * 0.18
    )
    lexical_diversity = 0.0 if token_count == 0 else clamp(unique_count / token_count)
    abstract_hits = _substring_hits(lower_text, ABSTRACT_STYLE_HINTS)
    ungrounded_abstract_penalty = _ungrounded_abstract_penalty(
        text_len=text_len,
        lexical_diversity=lexical_diversity,
        abstract_hits=abstract_hits,
        personal_grounding_score=personal_grounding_score,
    )

    repeat_pattern_penalty = _repeat_penalty(tokens, answer_text)
    emoji_symbol_penalty = _emoji_symbol_penalty(answer_text, token_count)
    spam_signature_penalty = _spam_penalty(answer_text, lower_text)

    return {
        "relevance_score": round(relevance_score, 4),
        "specificity_score": round(specificity_score, 4),
        "semantic_density": round(semantic_density, 4),
        "structure_score": round(structure_score, 4),
        "lexical_diversity": round(lexical_diversity, 4),
        "emotional_concreteness": round(emotional_concreteness, 4),
        "personal_grounding_score": round(personal_grounding_score, 4),
        "ungrounded_abstract_penalty": round(ungrounded_abstract_penalty, 4),
        "abstract_style_hits": abstract_hits,
        "repeat_pattern_penalty": round(repeat_pattern_penalty, 4),
        "emoji_symbol_penalty": round(emoji_symbol_penalty, 4),
        "spam_signature_penalty": round(spam_signature_penalty, 4),
        "answer_length": text_len,
        "token_count": token_count,
        "embedding_cosine": round(cosine, 4),
        "lexical_question_overlap": round(lexical_overlap, 4),
    }


def decide(
    depth_score: float,
    answer_length: int,
    features: Mapping[str, Any],
    *,
    threshold: float = DEPTH_SCORE_THRESHOLD,
    ungrounded_abstract_review_threshold: float = UNGROUNDED_ABSTRACT_REVIEW_THRESHOLD,
    abstract_style_hit_threshold: int | None = ABSTRACT_STYLE_REVIEW_MIN_HITS,
    gray_band: float = DEPTH_GRAY_BAND,
    fast_track_threshold: float = FAST_TRACK_THRESHOLD,
    min_answer_length: int = MIN_ANSWER_LENGTH,
    fast_track_min_length: int = FAST_TRACK_MIN_LENGTH,
) -> Decision:
    if float(features.get("spam_signature_penalty", 0.0)) >= 0.65:
        return Decision("REJECT", "SPAM_REJECT", ["SPAM_SIGNATURE"])
    if float(features.get("repeat_pattern_penalty", 0.0)) >= 0.70:
        return Decision("REJECT", "SPAM_REJECT", ["REPEAT_DOMINANT"])
    if float(features.get("emoji_symbol_penalty", 0.0)) >= 0.75:
        return Decision("REJECT", "SPAM_REJECT", ["SYMBOL_DOMINANT"])
    if (
        abstract_style_hit_threshold is not None
        and int(features.get("abstract_style_hits", 0)) >= abstract_style_hit_threshold
        and float(features.get("personal_grounding_score", 0.0))
        < MAX_PERSONAL_GROUNDING_FOR_ABSTRACT_REVIEW
    ):
        return Decision("REVIEW", "GRAY_BAND", ["UNGROUNDED_ABSTRACT_REVIEW"])
    if (
        depth_score >= threshold
        and float(features.get("ungrounded_abstract_penalty", 0.0))
        >= ungrounded_abstract_review_threshold
    ):
        return Decision("REVIEW", "GRAY_BAND", ["UNGROUNDED_ABSTRACT_REVIEW"])

    if depth_score >= fast_track_threshold and answer_length >= fast_track_min_length:
        reason_codes = ["FAST_TRACK_SCORE"]
        if float(features.get("specificity_score", 0.0)) >= 0.55:
            reason_codes.append("SPECIFIC")
        if float(features.get("emotional_concreteness", 0.0)) >= 0.35:
            reason_codes.append("EMOTIONAL_CONCRETE")
        if float(features.get("personal_grounding_score", 0.0)) >= 0.45:
            reason_codes.append("PERSONALLY_GROUNDED")
        return Decision("PASS", "FAST_TRACK", reason_codes)

    if abs(depth_score - threshold) <= gray_band:
        return Decision("REVIEW", "GRAY_BAND", ["GRAY_BAND"])
    if depth_score >= threshold and answer_length >= min_answer_length:
        return Decision("PASS", "BASIC", ["BASIC_SCORE"])

    reason_codes: list[str] = []
    if answer_length < fast_track_min_length:
        reason_codes.append("TOO_SHORT")
    if depth_score < threshold:
        reason_codes.append("LOW_SCORE")
    return Decision("REJECT", "LOW_SCORE", reason_codes)


def score_pair(
    question_text: str,
    answer_text: str,
    question_embedding: Sequence[float],
    answer_embedding: Sequence[float],
    *,
    product_context: str | None = None,
    threshold: float = DEPTH_SCORE_THRESHOLD,
    ungrounded_abstract_review_threshold: float = UNGROUNDED_ABSTRACT_REVIEW_THRESHOLD,
    abstract_style_hit_threshold: int | None = ABSTRACT_STYLE_REVIEW_MIN_HITS,
) -> dict[str, Any]:
    features = extract_features(question_text, answer_text, question_embedding, answer_embedding)
    depth_score = round(clamp(calculate_depth_raw(features), 0.0, 1.0), 4)

    if product_context == "ONBOARDING":
        decision = Decision("PASS", "ONBOARDING_PASS", ["ONBOARDING_BYPASS"])
    else:
        decision = decide(
            depth_score,
            int(features["answer_length"]),
            features,
            threshold=threshold,
            ungrounded_abstract_review_threshold=ungrounded_abstract_review_threshold,
            abstract_style_hit_threshold=abstract_style_hit_threshold,
        )

    return {
        "depth_score": depth_score,
        "verdict": decision.verdict,
        "path": decision.path,
        "reason_codes": decision.reason_codes,
        "features": features,
        "policy_version": POLICY_VERSION,
    }


def threshold_band(score: float, threshold: float = DEPTH_SCORE_THRESHOLD) -> str:
    low = threshold - DEPTH_GRAY_BAND
    high = threshold + DEPTH_GRAY_BAND
    if score < low:
        return "below_gray"
    if score <= high:
        return "in_gray_band"
    if score < FAST_TRACK_THRESHOLD:
        return "above_threshold_below_fast_track"
    return "fast_track_or_above"


def percentile(sorted_values: Sequence[float], p: float) -> float | None:
    if not sorted_values:
        return None
    if p <= 0:
        return float(sorted_values[0])
    if p >= 100:
        return float(sorted_values[-1])
    rank = (len(sorted_values) - 1) * (p / 100.0)
    low = int(math.floor(rank))
    high = int(math.ceil(rank))
    if low == high:
        return float(sorted_values[low])
    weight = rank - low
    return float(sorted_values[low] * (1.0 - weight) + sorted_values[high] * weight)


def count_distribution(values: Iterable[str]) -> dict[str, int]:
    counter: Counter[str] = Counter(values)
    return {key: int(counter[key]) for key in sorted(counter)}


def agreement_with_synthetic_prior(
    model_verdicts: Sequence[str], synthetic_labels: Sequence[str]
) -> dict[str, Any]:
    if len(model_verdicts) != len(synthetic_labels):
        raise ValueError("verdict/label length mismatch")
    if not model_verdicts:
        return {
            "metric": METRIC_AGREEMENT,
            "n": 0,
            "agreements": 0,
            "disagreements": 0,
            "rate": None,
            "note": "synthetic design prior only; offline label-disagreement proxy",
        }
    agreements = sum(1 for left, right in zip(model_verdicts, synthetic_labels) if left == right)
    n = len(model_verdicts)
    return {
        "metric": METRIC_AGREEMENT,
        "n": n,
        "agreements": agreements,
        "disagreements": n - agreements,
        "rate": round(agreements / n, 6),
        "note": "synthetic design prior only; offline label-disagreement proxy",
    }


def embedding_health(vectors: Sequence[Sequence[float]]) -> dict[str, Any]:
    dims: list[int] = []
    nan_count = 0
    inf_count = 0
    for vector in vectors:
        dims.append(len(vector))
        for value in vector:
            if math.isnan(value):
                nan_count += 1
            elif math.isinf(value):
                inf_count += 1
    dim_set = sorted(set(dims))
    return {
        "vector_count": len(vectors),
        "dims_observed": dim_set,
        "expected_dim": EXPECTED_EMBEDDING_DIM,
        "dim_ok": dim_set == [EXPECTED_EMBEDDING_DIM] if vectors else False,
        "nan_count": nan_count,
        "inf_count": inf_count,
    }


def max_abs_diff(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right):
        return float("inf")
    return max(abs(a - b) for a, b in zip(left, right)) if left else 0.0


def _substring_hits(text: str, hints: set[str]) -> int:
    return sum(1 for hint in hints if hint in text)


def _ungrounded_abstract_penalty(
    *, text_len: int, lexical_diversity: float, abstract_hits: int, personal_grounding_score: float
) -> float:
    penalty = max(0, abstract_hits - 1) * 0.18
    if text_len >= 32:
        penalty += 0.20
    if lexical_diversity >= 0.75:
        penalty += 0.15
    penalty -= personal_grounding_score * 0.70
    return clamp(penalty)


def _repeat_penalty(tokens: list[str], text: str) -> float:
    if not tokens:
        return 0.80 if REPEATED_CHAR_RE.search(text) else 0.0
    counts = Counter(tokens)
    most_common_ratio = counts.most_common(1)[0][1] / len(tokens)
    duplicate_bigram_ratio = 0.0
    if len(tokens) >= 4:
        bigrams = list(zip(tokens, tokens[1:]))
        duplicate_bigram_ratio = 1.0 - (len(set(bigrams)) / len(bigrams))
    repeated_char = 0.45 if REPEATED_CHAR_RE.search(text) else 0.0
    return clamp((most_common_ratio - 0.25) * 1.4 + duplicate_bigram_ratio + repeated_char)


def _emoji_symbol_penalty(text: str, token_count: int) -> float:
    emoji_count = sum(len(match.group(0)) for match in EMOJI_RE.finditer(text))
    symbol_count = len(re.findall(r"[^\w\s가-힣.,!?~]", text))
    return clamp((emoji_count + symbol_count * 0.4) / max(3, token_count))


def _spam_penalty(text: str, lower_text: str) -> float:
    penalty = 0.0
    if URL_RE.search(text):
        penalty += 0.75
    if PHONE_RE.search(text):
        penalty += 0.90
    penalty += sum(0.18 for term in SPAM_TERMS if term in lower_text)

    contact_hits = _substring_hits(lower_text, CONTACT_SOLICITATION_HINTS)
    if contact_hits:
        penalty += 0.35
        if contact_hits >= 2:
            penalty += 0.25

    promo_hits = _substring_hits(lower_text, SELF_PROMO_HINTS)
    penalty += min(promo_hits, 2) * 0.25
    if promo_hits >= 2:
        penalty += 0.25

    if _substring_hits(lower_text, MISMATCH_HINTS):
        penalty += 0.70

    digit_count = len(re.findall(r"\d", text))
    if digit_count >= 8:
        penalty += 0.55
    if re.fullmatch(r"\d{6,}", text.strip()):
        penalty += 0.35
    return clamp(penalty)
