from __future__ import annotations

from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class Verdict(StrEnum):
    PASS = "PASS"
    REVIEW = "REVIEW"
    REJECT = "REJECT"


class DecisionPath(StrEnum):
    BASIC = "BASIC"
    FAST_TRACK = "FAST_TRACK"
    GRAY_BAND = "GRAY_BAND"
    SPAM_REJECT = "SPAM_REJECT"
    LOW_SCORE = "LOW_SCORE"


class DepthEvaluateRequest(BaseModel):
    user_id: UUID
    question_id: UUID
    answer_id: UUID
    question_text: str = Field(min_length=1, max_length=2000)
    answer_text: str = Field(min_length=1, max_length=4000)


class DepthEvaluateResponse(BaseModel):
    depth_score: float
    verdict: Verdict
    path: DecisionPath
    reason_codes: list[str]
    features: dict[str, Any]
    model_version: str
    latency_ms: int


class Decision(BaseModel):
    verdict: Verdict
    path: DecisionPath
    reason_codes: list[str]

