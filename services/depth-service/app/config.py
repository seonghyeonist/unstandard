from __future__ import annotations

import json
import time
from typing import Any

import asyncpg
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    tei_base_url: str = Field(default="http://localhost:8080", alias="TEI_BASE_URL")
    qwen_review_url: str | None = Field(default=None, alias="QWEN_REVIEW_URL")
    app_config_cache_ttl_seconds: float = Field(default=5.0, alias="APP_CONFIG_CACHE_TTL_SECONDS")

    # Server-only containment gate for the still-dormant PoC. Both of these
    # must be explicitly set (env, never app_config/DB) before
    # /internal/depth/evaluate will do anything beyond reject the request.
    # Absence of either — the default — must never activate scoring.
    local_ai_poc_enabled: bool = Field(default=False, alias="UNSTANDARD_LOCAL_AI_POC_ENABLED")
    local_ai_service_token: str | None = Field(
        default=None, alias="UNSTANDARD_DEPTH_SERVICE_TOKEN"
    )


class RuntimeConfig(BaseModel):
    # Fail closed: absence of app_config (no DB pool, empty table, or any
    # other reason the value can't be loaded) must never enable scoring.
    local_ai_enabled: bool = False
    embedding_model: str = "BAAI/bge-m3"
    embedding_dim: int = 1024
    depth_model_version: str = "local-v0.1"
    depth_score_threshold: float = 0.38
    fast_track_threshold: float = 0.55
    min_answer_length: int = 12
    fast_track_min_length: int = 8
    depth_gray_band: float = 0.03
    qwen_review_enabled: bool = False
    qwen_review_sample_rate: float = 0.10
    max_depth_latency_ms_p95: int = 1200

    @property
    def full_model_version(self) -> str:
        return f"{self.depth_model_version}+{self.embedding_model.split('/')[-1]}"


class AppConfigProvider:
    def __init__(self, settings: Settings, pool: asyncpg.Pool | None):
        self._settings = settings
        self._pool = pool
        self._cached = RuntimeConfig()
        self._cached_at = 0.0

    async def get(self) -> RuntimeConfig:
        if not self._pool:
            return self._cached

        now = time.monotonic()
        if now - self._cached_at < self._settings.app_config_cache_ttl_seconds:
            return self._cached

        rows = await self._pool.fetch("SELECT key, value FROM app_config")
        values: dict[str, Any] = {}
        for row in rows:
            value = row["value"]
            if isinstance(value, str):
                value = json.loads(value)
            values[row["key"]] = value

        self._cached = RuntimeConfig(**values)
        self._cached_at = now
        return self._cached

