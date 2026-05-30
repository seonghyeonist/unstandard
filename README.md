# Unstandard Depth Scoring Service

Independent FastAPI service for v4.2 Depth Score evaluation.

## Architecture

- `depth-service`: independent API for answer quality scoring.
- `tei`: Hugging Face Text Embeddings Inference serving `BAAI/bge-m3`.
- `postgres`: PostgreSQL 16 with `pgvector`.
- Optional Qwen review is isolated behind `QWEN_REVIEW_URL` and only triggered asynchronously for gray-band cases when enabled in `app_config`.

## Run

```powershell
docker compose up --build
```

Evaluate:

```powershell
Invoke-RestMethod -Method Post http://localhost:8000/internal/depth/evaluate `
  -ContentType 'application/json' `
  -Body '{
    "user_id":"11111111-1111-1111-1111-111111111111",
    "question_id":"22222222-2222-2222-2222-222222222222",
    "answer_id":"33333333-3333-3333-3333-333333333333",
    "question_text":"요즘 당신을 이상하게 웃게 만드는 것은?",
    "answer_text":"퇴근길에 같은 가로수를 보면 이상하게 하루가 덜 망한 것 같아요."
  }'
```

## Runtime Config

Thresholds live in `app_config` and are refreshed by the service without redeploying:

```sql
UPDATE app_config SET value = '0.40', updated_at = now()
WHERE key = 'depth_score_threshold';
```

## Privacy Notes

Raw answer text is not persisted by this service. It stores answer IDs, embeddings, feature snapshots, scores, verdicts, reason codes, model version, thresholds, and latency. Delete requests should remove both `answer_embeddings` and `depth_evaluations` for the requested `answer_id` or `user_id`.

