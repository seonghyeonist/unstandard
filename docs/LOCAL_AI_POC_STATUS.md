# Local AI Depth Score PoC — Status

## Current status: `INACTIVE / NOT DEPLOYABLE`

`services/depth-service` (and `docker-compose.yml`'s `tei`/`postgres` sidecars) are
**dormant scaffolding**, not an implemented or deployable feature. Nothing in this
repository wires them into the live app, Preview, or Production. This document
records what was audited and contained in P0.4A so nobody mistakes the scaffold
for a shipped PoC.

The live app's answer-unlock scoring is, and remains, exactly:

```text
mock-local-heuristic-v0.0
```

— a deterministic, explainable, non-AI heuristic (`lib/depth/evaluate-depth-answer.ts`).
There is no code path, environment variable, or configuration value that can make
the live Next.js app call a remote Depth service instead.

## What P0.4A found and contained

| # | Finding | Where | Containment |
|---|---|---|---|
| 1 | `NEXT_PUBLIC_API_BASE_URL` (a public/client-exposed variable) could redirect `/api/answers/unlock` to call `/internal/depth/evaluate` on an arbitrary configured host, sending raw question/answer text off-app. | `app/api/answers/unlock/route.ts` (removed branch), `lib/api/client.ts` (deleted) | The remote-selection branch and `lib/api/client.ts` are removed entirely. The unlock route only ever calls `evaluateDepthAnswer`. |
| 2 | The (now-removed) remote branch generated `answer_id: crypto.randomUUID()` instead of a persisted canonical `answers` row id, so any FK-constrained persistence in `services/depth-service` would have been invalid against real data. | `app/api/answers/unlock/route.ts` (removed) | Removed with the branch above. Not "fixed" by weakening FKs or inventing persistence — there is no unlock-time answer persistence to fix in this task. |
| 3 | `RuntimeConfig.local_ai_enabled` defaulted to `true`, and `AppConfigProvider.get()` returns that in-memory default whenever there is no DB pool (i.e. no `DATABASE_URL`) — so an unconfigured service would have scored as if explicitly enabled. | `services/depth-service/app/config.py` | Default flipped to `false`. Absence of DB/app_config now means disabled, not enabled. |
| 4 | `/internal/depth/evaluate` had no service-to-service authentication of any kind. | `services/depth-service/app/main.py` | Added `is_service_request_authorized()`: requires an explicit server-only opt-in (`UNSTANDARD_LOCAL_AI_POC_ENABLED`), a configured service token (`UNSTANDARD_DEPTH_SERVICE_TOKEN`), *and* a matching caller-supplied `X-Unstandard-Depth-Service-Token` header (constant-time comparison). All three are env-only — never sourced from `app_config`/DB. An `app_config.local_ai_enabled = true` row is **not** sufficient by itself; the endpoint still checks it in addition to the auth gate. |
| 5 | Embedding-service exceptions and dimension-mismatch details (model dimensions, raw exception text) were returned verbatim in HTTP error bodies. | `services/depth-service/app/main.py` | Both error paths now log the detail server-side (`logger.exception` / `logger.error`) and return only a generic `"Local AI depth scoring is temporarily unavailable"` detail. |
| 6 | Gray-band Qwen review *would* send raw question/answer text to `settings.qwen_review_url` if later enabled. | `services/depth-service/app/qwen.py` | Logic unchanged (already gated on `qwen_review_enabled` + a configured URL, both default off/`None`). Contained the two places a **default** remote target could sneak in: `docker-compose.yml`'s `QWEN_REVIEW_URL` interpolation and `.env.example` both previously shipped a live-looking default URL; both are now empty by default. |
| 7 | `migrations/001_depth_schema.sql` is a **legacy Docker-init PoC artifact** (mounted only into the local `postgres` container via `docker-entrypoint-initdb.d`), not part of the canonical Drizzle migration set under `drizzle/migrations/`. It also seeds `app_config.local_ai_enabled = true`. | `migrations/001_depth_schema.sql`, `docker-compose.yml` | Left unmodified, as instructed — it is legacy/isolated behind the new `local-ai-poc` Compose profile, not deleted or "fixed" in place. Documented here instead of silently ignored. |
| 8 | Canonical Drizzle's `depth_evaluations` (`lib/db/schema/answers.ts`) is **not schema-compatible** with what `services/depth-service/app/db.py` writes. | see table below | Documented, not migrated (out of scope — no DB/migration changes in this task). |
| 9 | Canonical Drizzle has **no** `answer_embeddings` table and no pgvector contract at all — `services/depth-service/app/db.py` unconditionally `INSERT`s into it. | `lib/db/schema/*` (absent), `services/depth-service/app/db.py` | Documented. Persisting a depth evaluation against the canonical Neon schema would fail today; this is expected and not patched over. |
| 10 | The only existing Python tests (`tests/test_depth_scoring.py`) prove formula/decision fragments, not default-off behavior, endpoint auth, error redaction, or absence of outbound calls. | `services/depth-service/tests/test_depth_scoring.py` | Added `services/depth-service/tests/test_fail_closed_containment.py` — proves default-disabled config, the 3-gate auth requirement, no embedding call on unauthenticated/disabled requests, generic error redaction, and no outbound Qwen HTTP call by default. All run against monkeypatched network boundaries; no real network, model, Docker, or DB. |

## Canonical schema vs. legacy-PoC contract — exact drift

`depth_evaluations` exists in **both** places, but with different columns. Table
presence is not the issue; **column/type/FK compatibility is**:

| Column | Canonical Drizzle (`lib/db/schema/answers.ts`) | Legacy PoC (`migrations/001_depth_schema.sql` / `services/depth-service/app/db.py`) |
|---|---|---|
| `id` | `uuid` PK, default random | `uuid` PK, default `gen_random_uuid()` |
| `answer_id` | `uuid` NOT NULL, FK → `answers.id` (cascade), **unique** | `uuid` NOT NULL (no FK declared in the legacy SQL) |
| `user_id` | `text` NOT NULL, FK → `users.id` (cascade) | `uuid` NOT NULL (canonical `users.id` is `text`, not `uuid` — type mismatch) |
| `question_id` | *(does not exist)* | `uuid` NOT NULL |
| `score` | `numeric(6,4)` | *(service writes `depth_score numeric(5,4)`, a different column name/precision)* |
| `path` | `text` | `text` with a `CHECK` including `'LOW_SCORE'` (canonical has no CHECK constraint and no `LOW_SCORE` in its TS `DepthPath` union) |
| `features` | *(does not exist)* | `jsonb` NOT NULL |
| `threshold` | *(does not exist)* | `numeric(5,4)` NOT NULL |
| `latency_ms` | *(does not exist)* | `integer` |
| `reason_codes` | `text[]` default `'{}'` | `text[]` default `'{}'` (compatible) |
| `model_version` | `text` NOT NULL | `text` NOT NULL (compatible) |

There is also **no `answer_embeddings` table, no `vector` type, and no pgvector
extension** anywhere in the canonical Drizzle schema or `drizzle/migrations/`.
`services/depth-service/app/db.py` unconditionally writes to `answer_embeddings`
and would fail against a canonical Neon database today — this is expected, since
the service was never wired to canonical persistence, and is not treated as a bug
to silently patch (no FK weakening, no invented columns).

## What a later dedicated PoC branch must implement (out of scope here)

1. **Canonical migration design** — a real Drizzle migration (reviewed on its
   own branch) that either extends `depth_evaluations` with the columns the
   service actually needs, or defines a compatible response contract the app
   can persist without those columns; plus a deliberate `answer_embeddings` +
   pgvector design (extension, dimension, index type) if embeddings are kept
   server-side.
2. **Authenticated server-only client** — a Next.js server-only caller (not a
   `NEXT_PUBLIC_*`-gated one) that uses the same server-only opt-in + service
   token pattern added in this task, with the token sourced from a real secret
   store, never checked into `.env.example` with a value.
3. **Isolated local benchmark** — exercise `services/depth-service` against
   real TEI/BGE-M3 in a fully isolated environment (the `local-ai-poc` Compose
   profile added in this task, or an equivalent), never against Preview/Neon.
4. **Anonymized-label calibration** — calibrate thresholds/weights against the
   v4.2 labeling workbook only after it is handled per an explicit data-handling
   decision (see below); never commit or log the workbook's raw rows.
5. **Separate deployment decision** — a distinct, explicitly authorized decision
   to wire any of the above into Preview/Production, gated by the P0 safety
   checklist below.

## P0 security/readiness is unrelated and still not satisfied

This task does not change, and does not claim to change, the status recorded in
`docs/ALPHA_READINESS_CHECKLIST.md` (`BLOCKED_EXTERNAL`). Local AI containment
and P0 alpha readiness are two separate gates; passing one says nothing about
the other.

## The v4.2 labeling workbook is offline, not production truth

`project_sources/01-Unstandard_LabelingDataset_v0.1.xlsx` is a confidential,
offline label source for future calibration. Any measure of "disagreement"
between this workbook's labels and a heuristic/model score is, at most, an
**offline label-disagreement proxy**. It is never equivalent to, and must never
be reported as, real user harm, a false unlock experienced by a real user, a
report, or a block. It must not be committed, logged verbatim, or sent to any
model/service.
