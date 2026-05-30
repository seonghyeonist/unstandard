from __future__ import annotations

from collections.abc import Sequence

import httpx


class EmbeddingClient:
    def __init__(self, base_url: str, timeout_seconds: float = 1.0):
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds

    async def embed(self, inputs: Sequence[str]) -> list[list[float]]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(f"{self._base_url}/embed", json={"inputs": list(inputs)})
            response.raise_for_status()
            payload = response.json()

        embeddings = self._normalize_payload(payload)
        if len(embeddings) != len(inputs):
            raise ValueError(f"TEI returned {len(embeddings)} embeddings for {len(inputs)} inputs")
        return embeddings

    @staticmethod
    def _normalize_payload(payload: object) -> list[list[float]]:
        if isinstance(payload, dict):
            for key in ("embeddings", "data"):
                if key in payload:
                    payload = payload[key]
                    break

        if not isinstance(payload, list):
            raise ValueError("Unsupported embedding response format")

        if payload and isinstance(payload[0], dict) and "embedding" in payload[0]:
            return [item["embedding"] for item in payload]

        if payload and isinstance(payload[0], (int, float)):
            return [payload]

        return payload

