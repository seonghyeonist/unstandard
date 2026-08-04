# Local AI Technical PoC — Aggregate Handoff Template

Copy this template into an operator-local evidence note or PR comment.
Fill **aggregates only**. Leave any field unknown as `NOT_RUN` / `ABSENT`.

## Identity

| Field | Value |
|---|---|
| Date (UTC) | |
| Operator | |
| Repo branch | |
| Repo commit SHA | |
| Harness | `scripts/local-ai/poc_bge_m3.py` |
| Approved snapshot ID | `ULDS-v0.1-b63f77dc-20260804` |
| Workbook SHA-256 | `b63f77dc7fa10694e4af6d3fc5ee86c4fcb4b01bda0889a1e96bcba4b1a55e51` (must match) |
| Report path (local only) | `/tmp/unstandard-local-ai/reports/...json` |

## Gate stamps (fixed for this PoC)

| Gate | Required stamp |
|---|---|
| `HUMAN_LABEL_GATE` | `NOT_RUN_FOUNDER_DEFERRED` |
| Qwen | `INACTIVE_NOT_INSTALLED` |
| Alpha readiness | `NOT_CLAIMED` |
| Production scoring | `UNTOUCHED_MOCK_ACTIVE` |
| Preview/Production DB | `NOT_CONNECTED` |

## Preflight (aggregate)

| Item | Observed |
|---|---|
| OS / arch | |
| CPU count | |
| GPU | present / absent |
| RAM available | |
| Disk free under `/tmp/unstandard-local-ai` | |
| Python | |
| `torch` version | |
| `sentence-transformers` version | |
| Model id | `BAAI/bge-m3` |
| Model revision / digest | |

## Dataset counts

| Metric | Observed | Expected |
|---|---:|---:|
| Physical rows | | 1000 |
| Unique Q/A pairs | | ~260 |
| Unique pairs scored | | |
| Unique pair failures | | |

## Embedding / runtime health

| Metric | Observed |
|---|---|
| Embedding dim | |
| NaN count | |
| Inf count | |
| Determinism max abs diff | |
| Cold latency (probe) ms | |
| Warm latency (probe) ms | |
| Unique-pair latency P50 ms | |
| Unique-pair latency P95 ms | |
| Peak RSS bytes | |
| Throughput (pairs/sec) | |

## Score distribution (unique pairs only)

| Metric | Observed |
|---|---|
| Score P50 / P95 / mean | |
| Threshold band counts | below_gray / in_gray_band / above_threshold_below_fast_track / fast_track_or_above |
| Verdict counts | PASS / REVIEW / REJECT |
| Path counts | |
| Per-category n + score P50 (no raw text) | |

## Synthetic-prior agreement (not human accuracy)

| Field | Value |
|---|---|
| Metric name | `agreement_with_synthetic_prior` |
| n | |
| agreements | |
| disagreements | |
| rate | |
| Note | synthetic design prior only; **not** human ground truth |

## Verdict

| Field | Value |
|---|---|
| Technical verdict | `TECHNICAL_POC_PASS` / `TECHNICAL_POC_CONDITIONAL` / `TECHNICAL_POC_FAIL` / `BLOCKED_*` |
| Hard issues | |
| Soft issues | |

## Explicit non-claims

- [ ] No Alpha readiness claim
- [ ] No calibration-complete claim
- [ ] No human accuracy / ground-truth claim
- [ ] No raw Q/A, embeddings, model files, or secrets pasted here
