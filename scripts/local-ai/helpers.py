"""Pure helpers for the isolated BGE-M3 Local AI technical PoC.

No network, no model load, no workbook I/O. Safe to unit-test offline.
Mirrors scoring formulas from services/depth-service without importing it.
Never emits question/answer text.
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

# --- Canonical PoC contract (Part III / depth-service RuntimeConfig) ---
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
EXPECTED_EMBEDDING_DIM = 1024

HUMAN_LABEL_GATE_STATUS = "NOT_RUN_FOUNDER_DEFERRED"
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
TIME_HINTS = {"오늘", "어제", "요즘", "주말", "퇴근", "아침", "밤", "작년", "최근", "가끔", "매일"}
PLACE_HINTS = {"집", "회사", "학교", "카페", "길", "공원", "버스", "지하철", "동네", "방"}
EMOTION_HINTS = {
    "좋", "싫", "기쁘", "슬프", "웃", "편안", "불안", "무섭", "설레", "외롭", "고맙",
    "행복", "화", "미안", "아쉽", "부끄", "든든", "상처", "위로",
}
VALUE_HINTS = {"가치", "관계", "취향", "선호", "소중", "중요", "믿", "존중", "배려", "진심"}
EVASIVE = {"몰라", "글쎄", "없음", "없어요", "아무거나", "그냥", "딱히", "ㅎㅎ", "ㅋㅋ"}
SPAM_TERMS = {
    "카톡", "카카오", "오픈채팅", "텔레그램", "라인", "투자", "수익", "바카라", "토토",
    "성인", "조건만남", "만남보장", "무료", "이벤트", "링크", "프로필확인",
}

VERDICTS = ("TECHNICAL_POC_PASS", "TECHNICAL_POC_CONDITIONAL", "TECHNICAL_POC_FAIL",
            "BLOCKED_RUNTIME", "BLOCKED_MODEL_DOWNLOAD", "BLOCKED_RESOURCE_LIMIT",
            "BLOCKED_INPUT_FILE_NOT_FOUND", "BLOCKED_INPUT_HASH_MISMATCH")


@dataclass(frozen=True)
class Decision:
    verdict: str
    path: str
    reason_codes: list[str]


def clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def ascii_space_removed_length(text: str) -> int:
    """Workbook answer-length semantics: remove ASCII space U+0020 only."""
    return len(text.replace(" ", ""))


def normalize_pair_key(question: str, answer: str) -> str:
    """Ephemeral pair identity. Caller must not persist or print the key."""
    q = unicodedata.normalize("NFKC", question)
    a = unicodedata.normalize("NFKC", answer)
    q = "".join(q.split())
    a = "".join(a.split())
    digest = hashlib.sha256(f"{q}\n{a}".encode("utf-8")).hexdigest()
    return digest


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


class HashMismatchError(Exception):
    def __init__(self, observed: str) -> None:
        self.observed = observed
        super().__init__("BLOCKED_INPUT_HASH_MISMATCH")


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

    specificity_signals = 0
    specificity_signals += sum(1 for token in tokens if token in FIRST_PERSON)
    specificity_signals += sum(1 for token in tokens if token in TIME_HINTS)
    specificity_signals += sum(1 for token in tokens if token in PLACE_HINTS)
    specificity_signals += len(re.findall(r"\d+", answer_text))
    specificity_signals += sum(1 for token in tokens if len(token) >= 4)
    specificity_score = clamp(
        (specificity_signals / max(4, token_count * 0.45)) + min(text_len, 80) / 240
    )

    emotion_hits = sum(1 for hint in EMOTION_HINTS if hint in answer_text)
    value_hits = sum(1 for hint in VALUE_HINTS if hint in answer_text)
    situation_hits = sum(1 for token in tokens if token in TIME_HINTS or token in PLACE_HINTS)
    semantic_density = clamp(
        (specificity_signals + emotion_hits + value_hits) / max(6, token_count + 1) * 1.7
    )
    emotional_concreteness = clamp(
        (emotion_hits * 0.25) + (value_hits * 0.20) + (situation_hits * 0.12)
    )

    sentence_count = max(1, len(re.findall(r"[.!?。！？]|요\b|다\b", answer_text)))
    evasive_hits = sum(1 for word in EVASIVE if word in lower_text)
    structure_score = clamp(
        0.35 + min(sentence_count, 3) * 0.18 + min(text_len, 80) / 220 - evasive_hits * 0.18
    )

    lexical_diversity = 0.0 if token_count == 0 else clamp(unique_count / token_count)
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
    gray_band: float = DEPTH_GRAY_BAND,
    fast_track_threshold: float = FAST_TRACK_THRESHOLD,
    min_answer_length: int = MIN_ANSWER_LENGTH,
    fast_track_min_length: int = FAST_TRACK_MIN_LENGTH,
) -> Decision:
    if float(features["spam_signature_penalty"]) >= 0.65:
        return Decision(verdict="REJECT", path="SPAM_REJECT", reason_codes=["SPAM_SIGNATURE"])

    if depth_score >= fast_track_threshold and answer_length >= fast_track_min_length:
        reason_codes = ["FAST_TRACK_SCORE"]
        if float(features["specificity_score"]) >= 0.55:
            reason_codes.append("SPECIFIC")
        if float(features["emotional_concreteness"]) >= 0.35:
            reason_codes.append("EMOTIONAL_CONCRETE")
        return Decision(verdict="PASS", path="FAST_TRACK", reason_codes=reason_codes)

    if abs(depth_score - threshold) <= gray_band:
        return Decision(verdict="REVIEW", path="GRAY_BAND", reason_codes=["GRAY_BAND"])

    if depth_score >= threshold and answer_length >= min_answer_length:
        return Decision(verdict="PASS", path="BASIC", reason_codes=["BASIC_SCORE"])

    reason_codes: list[str] = []
    if answer_length < fast_track_min_length:
        reason_codes.append("TOO_SHORT")
    if depth_score < threshold:
        reason_codes.append("LOW_SCORE")
    return Decision(verdict="REJECT", path="LOW_SCORE", reason_codes=reason_codes)


def score_pair(
    question_text: str,
    answer_text: str,
    question_embedding: Sequence[float],
    answer_embedding: Sequence[float],
) -> dict[str, Any]:
    features = extract_features(
        question_text, answer_text, question_embedding, answer_embedding
    )
    depth_raw = calculate_depth_raw(features)
    depth_score = round(clamp(depth_raw, 0.0, 1.0), 4)
    decision = decide(depth_score, int(features["answer_length"]), features)
    return {
        "depth_score": depth_score,
        "verdict": decision.verdict,
        "path": decision.path,
        "reason_codes": decision.reason_codes,
        "features": {
            "specificity_score": features["specificity_score"],
            "emotional_concreteness": features["emotional_concreteness"],
            "spam_signature_penalty": features["spam_signature_penalty"],
            "answer_length": features["answer_length"],
            "embedding_cosine": features["embedding_cosine"],
        },
    }


def threshold_band(score: float) -> str:
    """Bucket a score relative to the canonical threshold ± gray band."""
    low = DEPTH_SCORE_THRESHOLD - DEPTH_GRAY_BAND
    high = DEPTH_SCORE_THRESHOLD + DEPTH_GRAY_BAND
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
    model_verdicts: Sequence[str],
    synthetic_labels: Sequence[str],
) -> dict[str, Any]:
    """Offline proxy only. Never call this 'accuracy' or 'ground truth'."""
    if len(model_verdicts) != len(synthetic_labels):
        raise ValueError("verdict/label length mismatch")
    if not model_verdicts:
        return {
            "metric": METRIC_AGREEMENT,
            "n": 0,
            "agreements": 0,
            "disagreements": 0,
            "rate": None,
            "note": "synthetic design prior only; not human ground truth",
        }
    agreements = sum(
        1 for left, right in zip(model_verdicts, synthetic_labels) if left == right
    )
    n = len(model_verdicts)
    return {
        "metric": METRIC_AGREEMENT,
        "n": n,
        "agreements": agreements,
        "disagreements": n - agreements,
        "rate": round(agreements / n, 6),
        "note": "synthetic design prior only; not human ground truth",
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


def _repeat_penalty(tokens: list[str], text: str) -> float:
    if not tokens:
        return 0.0
    counts = Counter(tokens)
    most_common_ratio = counts.most_common(1)[0][1] / len(tokens)
    duplicate_bigram_ratio = 0.0
    if len(tokens) >= 4:
        bigrams = list(zip(tokens, tokens[1:]))
        duplicate_bigram_ratio = 1.0 - (len(set(bigrams)) / len(bigrams))
    repeated_char = 0.35 if REPEATED_CHAR_RE.search(text) else 0.0
    return clamp((most_common_ratio - 0.25) * 1.4 + duplicate_bigram_ratio + repeated_char)


def _emoji_symbol_penalty(text: str, token_count: int) -> float:
    emoji_count = sum(len(match.group(0)) for match in EMOJI_RE.finditer(text))
    symbol_count = len(re.findall(r"[^\w\s가-힣.,!?~]", text))
    return clamp((emoji_count + symbol_count * 0.4) / max(3, token_count))


def _spam_penalty(text: str, lower_text: str) -> float:
    penalty = 0.0
    if URL_RE.search(text):
        penalty += 0.65
    if PHONE_RE.search(text):
        penalty += 0.75
    penalty += sum(0.22 for term in SPAM_TERMS if term in lower_text)
    if len(re.findall(r"\d", text)) >= 8:
        penalty += 0.25
    return clamp(penalty)
