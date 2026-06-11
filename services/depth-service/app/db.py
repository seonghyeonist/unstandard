from __future__ import annotations

import json
from uuid import UUID

import asyncpg

from app.config import Settings


async def create_pool(settings: Settings) -> asyncpg.Pool | None:
    if not settings.database_url:
        return None
    return await asyncpg.create_pool(settings.database_url, min_size=1, max_size=5)


async def persist_evaluation(
    pool: asyncpg.Pool | None,
    *,
    answer_id: UUID,
    user_id: UUID,
    question_id: UUID,
    embedding: list[float],
    depth_score: float,
    verdict: str,
    path: str,
    features: dict,
    reason_codes: list[str],
    threshold: float,
    model_version: str,
    latency_ms: int,
) -> None:
    if not pool:
        return

    embedding_literal = "[" + ",".join(f"{value:.8f}" for value in embedding) + "]"
    features_json = json.dumps(features, ensure_ascii=False)

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO answer_embeddings (
                  answer_id, user_id, question_id, model_version, embedding
                )
                VALUES ($1, $2, $3, $4, $5::vector)
                ON CONFLICT (answer_id) DO UPDATE SET
                  model_version = EXCLUDED.model_version,
                  embedding = EXCLUDED.embedding
                """,
                answer_id,
                user_id,
                question_id,
                model_version,
                embedding_literal,
            )
            await conn.execute(
                """
                INSERT INTO depth_evaluations (
                  answer_id, user_id, question_id, depth_score, verdict, path,
                  features, reason_codes, threshold, model_version, latency_ms
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::text[], $9, $10, $11)
                """,
                answer_id,
                user_id,
                question_id,
                depth_score,
                verdict,
                path,
                features_json,
                reason_codes,
                threshold,
                model_version,
                latency_ms,
            )

