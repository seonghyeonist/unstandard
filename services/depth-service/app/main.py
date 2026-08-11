from __future__ import annotations

import hmac
import logging
import time
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException

from app.config import AppConfigProvider, Settings
from app.db import create_pool, persist_evaluation
from app.decision import decide
from app.embedding_client import EmbeddingClient
from app.features import calculate_depth_raw, clamp, extract_features
from app.models import DepthEvaluateRequest, DepthEvaluateResponse
from app.qwen import maybe_request_qwen_review


logger = logging.getLogger("unstandard.depth_service")

# Generic, infra-detail-free error text for every public error response.
# Real exception text, model dimensions, and internal URLs are logged
# server-side only (see logger.* calls below), never returned to callers.
GENERIC_UNAVAILABLE_DETAIL = "Local AI depth scoring is temporarily unavailable"
GENERIC_UNAUTHORIZED_DETAIL = "Unauthorized"

settings = Settings()


def is_service_request_authorized(request_token: str | None) -> bool:
    """Fail closed: every one of these must hold, or the request is denied.

    - explicit server-only opt-in (env var, never app_config/DB)
    - a configured service token (env var, never app_config/DB)
    - a caller-supplied token that matches via constant-time comparison
    """
    if not settings.local_ai_poc_enabled:
        return False
    if not settings.local_ai_service_token:
        return False
    if not request_token:
        return False
    return hmac.compare_digest(request_token, settings.local_ai_service_token)


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await create_pool(settings)
    app.state.db_pool = pool
    app.state.config_provider = AppConfigProvider(settings, pool)
    app.state.embedding_client = EmbeddingClient(settings.tei_base_url)
    try:
        yield
    finally:
        if pool:
            await pool.close()


app = FastAPI(title="Unstandard Depth Scoring Service", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/depth/evaluate", response_model=DepthEvaluateResponse)
async def evaluate_depth(
    request: DepthEvaluateRequest,
    background_tasks: BackgroundTasks,
    x_unstandard_depth_service_token: str | None = Header(default=None),
) -> DepthEvaluateResponse:
    # Authentication is checked before any config/DB/embedding work — an
    # unauthenticated or missing-token caller triggers zero side effects.
    if not is_service_request_authorized(x_unstandard_depth_service_token):
        raise HTTPException(status_code=401, detail=GENERIC_UNAUTHORIZED_DETAIL)

    started = time.perf_counter()
    config = await app.state.config_provider.get()
    # An app_config local_ai_enabled=true alone is not sufficient — the
    # server-only opt-in + token check above already gated this line.
    if not config.local_ai_enabled:
        raise HTTPException(status_code=503, detail=GENERIC_UNAVAILABLE_DETAIL)

    try:
        question_embedding, answer_embedding = await app.state.embedding_client.embed(
            [request.question_text, request.answer_text]
        )
    except Exception:
        logger.exception("embedding service call failed")
        raise HTTPException(status_code=503, detail=GENERIC_UNAVAILABLE_DETAIL) from None

    if len(answer_embedding) != config.embedding_dim:
        logger.error(
            "embedding dimension mismatch: expected=%s got=%s",
            config.embedding_dim,
            len(answer_embedding),
        )
        raise HTTPException(status_code=502, detail=GENERIC_UNAVAILABLE_DETAIL)

    feature_result = extract_features(
        request.question_text,
        request.answer_text,
        question_embedding,
        answer_embedding,
    )
    features = feature_result.features
    depth_raw = calculate_depth_raw(features)
    depth_score = round(clamp(depth_raw, 0.0, 1.0), 4)
    features["depth_raw"] = round(depth_raw, 4)

    decision = decide(depth_score, features["answer_length"], features, config)
    reason_codes = sorted(set(feature_result.reason_codes + decision.reason_codes))
    latency_ms = int((time.perf_counter() - started) * 1000)

    response = DepthEvaluateResponse(
        depth_score=depth_score,
        verdict=decision.verdict,
        path=decision.path,
        reason_codes=reason_codes,
        features=features,
        model_version=config.full_model_version,
        latency_ms=latency_ms,
    )

    await persist_evaluation(
        app.state.db_pool,
        answer_id=request.answer_id,
        user_id=request.user_id,
        question_id=request.question_id,
        embedding=answer_embedding,
        depth_score=depth_score,
        verdict=response.verdict.value,
        path=response.path.value,
        features=features,
        reason_codes=reason_codes,
        threshold=config.depth_score_threshold,
        model_version=config.full_model_version,
        latency_ms=latency_ms,
    )

    if response.path.value == "GRAY_BAND":
        background_tasks.add_task(
            maybe_request_qwen_review,
            request,
            response.model_dump(mode="json"),
            config,
            settings,
        )

    return response

