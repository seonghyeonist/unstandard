from __future__ import annotations

import random
from typing import Any

import httpx

from app.config import RuntimeConfig, Settings
from app.models import DepthEvaluateRequest


async def maybe_request_qwen_review(
    request: DepthEvaluateRequest,
    response_payload: dict[str, Any],
    config: RuntimeConfig,
    settings: Settings,
) -> None:
    if not config.qwen_review_enabled or not settings.qwen_review_url:
        return
    if random.random() > config.qwen_review_sample_rate:
        return

    payload = {
        "answer_id": str(request.answer_id),
        "question_id": str(request.question_id),
        "question_text": request.question_text,
        "answer_text": request.answer_text,
        "depth_score": response_payload["depth_score"],
        "features": response_payload["features"],
        "reason_codes": response_payload["reason_codes"],
        "model_version": response_payload["model_version"],
    }

    try:
        async with httpx.AsyncClient(timeout=0.8) as client:
            await client.post(settings.qwen_review_url, json=payload)
    except httpx.HTTPError:
        # Qwen is an isolated assistant path; scoring must not fail when it is unavailable.
        return

