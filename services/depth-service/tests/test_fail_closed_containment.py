"""P0.4A containment proofs.

These tests prove the dormant Local AI PoC cannot activate by accident.
No real network, model, Docker, or database is used: embedding/HTTP calls
are monkeypatched to raise if they are ever reached, so any regression that
would allow an outbound call fails the test rather than silently passing.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

import app.main as main_module
from app.config import AppConfigProvider, RuntimeConfig, Settings
from app.main import (
    GENERIC_UNAUTHORIZED_DETAIL,
    GENERIC_UNAVAILABLE_DETAIL,
    app,
    is_service_request_authorized,
)
from app.models import DepthEvaluateRequest
from app.qwen import maybe_request_qwen_review


def _evaluate_payload() -> dict[str, str]:
    return {
        "user_id": str(uuid.uuid4()),
        "question_id": str(uuid.uuid4()),
        "answer_id": str(uuid.uuid4()),
        "question_text": "요즘 당신을 웃게 만드는 것은?",
        "answer_text": "어제 퇴근길에 본 고양이가 자꾸 생각나요.",
    }


def test_settings_default_to_local_ai_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (
        "UNSTANDARD_LOCAL_AI_POC_ENABLED",
        "UNSTANDARD_DEPTH_SERVICE_TOKEN",
        "QWEN_REVIEW_URL",
        "DATABASE_URL",
    ):
        monkeypatch.delenv(key, raising=False)

    settings = Settings()
    assert settings.local_ai_poc_enabled is False
    assert settings.local_ai_service_token is None
    assert settings.qwen_review_url is None


def test_runtime_config_defaults_local_ai_enabled_false() -> None:
    assert RuntimeConfig().local_ai_enabled is False


@pytest.mark.asyncio
async def test_app_config_provider_get_defaults_disabled_without_pool() -> None:
    """Absence of DATABASE_URL/app_config must never enable scoring."""
    provider = AppConfigProvider(Settings(), pool=None)
    config = await provider.get()
    assert config.local_ai_enabled is False


def test_authorization_requires_every_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main_module.settings, "local_ai_poc_enabled", False)
    monkeypatch.setattr(main_module.settings, "local_ai_service_token", "correct-token")
    assert is_service_request_authorized("correct-token") is False  # opt-in missing

    monkeypatch.setattr(main_module.settings, "local_ai_poc_enabled", True)
    monkeypatch.setattr(main_module.settings, "local_ai_service_token", None)
    assert is_service_request_authorized("anything") is False  # no configured token

    monkeypatch.setattr(main_module.settings, "local_ai_service_token", "correct-token")
    assert is_service_request_authorized(None) is False  # no caller token
    assert is_service_request_authorized("wrong-token") is False  # mismatched token
    assert is_service_request_authorized("correct-token") is True  # all gates satisfied


def test_evaluate_endpoint_rejects_missing_auth_without_touching_embeddings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(main_module.settings, "local_ai_poc_enabled", False)
    monkeypatch.setattr(main_module.settings, "local_ai_service_token", None)

    async def _forbidden_embed(self, inputs):  # noqa: ANN001
        raise AssertionError("embedding client must not be called for an unauthenticated request")

    monkeypatch.setattr("app.embedding_client.EmbeddingClient.embed", _forbidden_embed)

    with TestClient(app) as client:
        response = client.post("/internal/depth/evaluate", json=_evaluate_payload())

    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_UNAUTHORIZED_DETAIL


def test_evaluate_endpoint_rejects_wrong_token_even_when_poc_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(main_module.settings, "local_ai_poc_enabled", True)
    monkeypatch.setattr(main_module.settings, "local_ai_service_token", "correct-token")

    async def _forbidden_embed(self, inputs):  # noqa: ANN001
        raise AssertionError("embedding client must not be called for an invalid token")

    monkeypatch.setattr("app.embedding_client.EmbeddingClient.embed", _forbidden_embed)

    with TestClient(app) as client:
        response = client.post(
            "/internal/depth/evaluate",
            headers={"x-unstandard-depth-service-token": "wrong-token"},
            json=_evaluate_payload(),
        )

    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_UNAUTHORIZED_DETAIL


def test_evaluate_endpoint_rejects_when_app_config_disabled_despite_valid_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A valid token + server-only opt-in is not enough on its own —
    app_config local_ai_enabled must also be true (default False)."""
    monkeypatch.setattr(main_module.settings, "local_ai_poc_enabled", True)
    monkeypatch.setattr(main_module.settings, "local_ai_service_token", "correct-token")

    async def _forbidden_embed(self, inputs):  # noqa: ANN001
        raise AssertionError("embedding client must not be called while app_config is disabled")

    monkeypatch.setattr("app.embedding_client.EmbeddingClient.embed", _forbidden_embed)

    with TestClient(app) as client:
        response = client.post(
            "/internal/depth/evaluate",
            headers={"x-unstandard-depth-service-token": "correct-token"},
            json=_evaluate_payload(),
        )

    assert response.status_code == 503
    assert response.json()["detail"] == GENERIC_UNAVAILABLE_DETAIL


def test_evaluate_endpoint_redacts_embedding_exception_detail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(main_module.settings, "local_ai_poc_enabled", True)
    monkeypatch.setattr(main_module.settings, "local_ai_service_token", "correct-token")

    async def _fake_get(self):  # noqa: ANN001
        return RuntimeConfig(local_ai_enabled=True)

    monkeypatch.setattr(main_module.AppConfigProvider, "get", _fake_get)

    secret_marker = "internal-embedding-host-10.0.5.9-leak"

    async def _boom(self, inputs):  # noqa: ANN001
        raise RuntimeError(secret_marker)

    monkeypatch.setattr("app.embedding_client.EmbeddingClient.embed", _boom)

    with TestClient(app) as client:
        response = client.post(
            "/internal/depth/evaluate",
            headers={"x-unstandard-depth-service-token": "correct-token"},
            json=_evaluate_payload(),
        )

    assert response.status_code == 503
    assert secret_marker not in response.text
    assert response.json()["detail"] == GENERIC_UNAVAILABLE_DETAIL


@pytest.mark.asyncio
async def test_qwen_review_makes_no_outbound_request_when_disabled_by_default() -> None:
    class _ExplodingAsyncClient:
        def __init__(self, *args, **kwargs):  # noqa: ANN002, ANN003
            raise AssertionError(
                "httpx.AsyncClient must not be constructed when Qwen review is disabled"
            )

    request = DepthEvaluateRequest(
        user_id=uuid.uuid4(),
        question_id=uuid.uuid4(),
        answer_id=uuid.uuid4(),
        question_text="질문",
        answer_text="답변",
    )

    import httpx

    original_async_client = httpx.AsyncClient
    httpx.AsyncClient = _ExplodingAsyncClient  # type: ignore[assignment,misc]
    try:
        await maybe_request_qwen_review(
            request,
            {"depth_score": 0.5, "features": {}, "reason_codes": [], "model_version": "x"},
            RuntimeConfig(),
            Settings(),
        )
    finally:
        httpx.AsyncClient = original_async_client  # type: ignore[misc]
