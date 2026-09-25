# Local AI v0.2 shadow integration

Last updated: 2026-09-25 (baseline integration evidence: 2026-09-24)

## Provenance and release boundary

- Stacked branch: `feat/local-ai-v0-2-shadow-integration-20260924`
- Base: PR #88 benchmarked head `4a8ee19b6d2c66b1d64b2fb40b1cf0b55389508a`
- PR #88 remains Draft/Open; PR #80 remains Draft/Open and was not changed.
- The live unlock scorer remains `mock-local-heuristic-v0.0`.
- Local AI shadow execution is default-off. No model endpoint or service token was added to Vercel, and no model service was deployed by this change.

## Canonical shadow persistence

The database unlock path persists each submission to `unlock_attempts` and its generated UUID is the real canonical identifier for that attempt. This differs from onboarding's `answers` table, so shadow records use `unlock_attempt_id` referencing `unlock_attempts.id`; the migration does not invent answer IDs, alter user ID types, or copy the legacy Docker PoC schema.

Migration `0015_orange_zarda.sql` adds only `local_ai_shadow_evaluations` with:

- primary UUID `id`;
- canonical `unlock_attempt_id` UUID foreign key with `ON DELETE CASCADE`;
- depth score, verdict, path, reason codes, model version, latency, and timestamp;
- allowlisted numeric summaries for grounding, abstraction, relevance, specificity, repetition, symbols, and spam;
- range, allowed-verdict, non-empty-path, bounded-reason, bounded-model-version, non-negative-latency, and per-attempt/model uniqueness constraints.

It has no user ID, answer text, question text, embeddings, or vector column. The pre-existing canonical `unlock_attempts` record remains the source attempt; the shadow table creates no second copy of its text.

## Disposable Neon validation

The migration was applied and tested only on Neon branch `br-rapid-frost-ajqgllm6` (`local-ai-v02-shadow-verify-20260924`), a non-default child of `br-bitter-wave-ajs8dy0u` (`main`). The verification branch is READY and expires `2026-09-27T00:00:00Z`.

Live branch validation confirmed:

- all 17 expected columns, primary key, cascading foreign key, indexes, and checks are present;
- an isolated synthetic row inserts successfully;
- duplicate `(unlock_attempt_id, model_version)` insertion is rejected by the unique constraint; the application repository uses plain INSERT and does not make replay idempotent;
- an out-of-range score and a missing attempt foreign key are rejected;
- deleting the synthetic canonical attempt cascades its shadow row;
- cleanup readback returned zero shadow rows, attempts, synthetic users, and synthetic questions.

The default Neon branch was inspected to confirm its identity and was not written. Production/default database state was not changed.

## Server-only caller and scorer boundary

The caller is imported only from the server-side database unlock service. It schedules a best-effort callback with Next.js `after()`, after the authoritative transaction commits. Its Preview-side config requires all of:

- `UNSTANDARD_LOCAL_AI_SHADOW_ENABLED=true`;
- an HTTPS `UNSTANDARD_LOCAL_AI_SHADOW_URL` ending at `/internal/depth/shadow-evaluate`;
- `UNSTANDARD_LOCAL_AI_SHADOW_TOKEN` from server secret storage.

Without all three, it schedules no request. Requests use the service-only `X-Unstandard-Depth-Service-Token` header, a 1.5-second caller timeout, no retry, no redirects, and a streaming 32 KiB response-byte cap. The TEI client retains its separate 1.0-second timeout. `Content-Length` is an early rejection hint; the stream byte count enforces the cap when that header is missing or false. Warm and cold model latency must be recorded separately. Logs contain only stable failure codes.

The dedicated Python route rejects caller identity fields and performs no database persistence, embedding persistence, or Qwen request. It returns only a scoring result and feature data. The Next.js caller validates the version and response shape, then writes only the allowlisted derived fields to the canonical shadow table. No client configuration or user-facing Local AI result is added.

The service result version is `local-v0.2+bge-m3`. The expected embedding model is `BAAI/bge-m3`, pinned to revision `5617a9f61b028005a4858fdac845db406aefb181`, with 1,024-dimensional output. The isolated local Compose profile pins this model revision; this does not attest a deployed endpoint until its actual runtime configuration is captured. The shadow schema does not store embeddings or any text. The Local AI result and any service failure are ignored for unlock behavior.

## Shadow-only runtime config and legacy-route boundary

The depth service still requires `UNSTANDARD_LOCAL_AI_POC_ENABLED=true` and a
matching `UNSTANDARD_DEPTH_SERVICE_TOKEN` for authenticated scoring. When
`UNSTANDARD_LOCAL_AI_SHADOW_CONFIG_ENABLED=true`, only
`/internal/depth/shadow-evaluate` uses the safe defaults in
`RuntimeConfig`; it does not query or modify shared `app_config`. This
flag defaults to false and does not change the global
`AppConfigProvider` fail-closed behavior.

The legacy `/internal/depth/evaluate` route additionally requires
`UNSTANDARD_LOCAL_AI_LEGACY_EVALUATE_ENABLED=true`, which must remain unset or
false for this shadow deployment. The route returns 404 without that separate
opt-in, even if the shadow auth token is valid. The shadow route does not call
legacy persistence or Qwen.

The intended bounded proof uses only synthetic Preview input and an isolated
disposable Neon branch with migration 0015. After proof, disable
`UNSTANDARD_LOCAL_AI_SHADOW_ENABLED`, remove the Preview-only token and URL,
clean up only this run's synthetic rows, and record branch teardown/expiry.

## Verification

- 2026-09-24 baseline `npm run check`: lint, typecheck, 373 Node tests, and production build passed before the 2026-09-25 follow-up changes.
- Node tests exercise the scheduled-flow boundary: scheduler registration, outbound fetch request, bounded streaming response parsing, and the persistence adapter with synthetic values. Fault cases cover a wrong-token service response, timeout, HTTP 500, malformed/oversized output, and repository failure. These tests use stubs; they do not establish a live app-to-Neon E2E proof.
- The separate invariant test keeps authoritative PASS/REVIEW/REJECT values unchanged across successful or failed shadow operations.
- 2026-09-24 baseline Python depth-service tests: 26 passed, including missing service auth before embeddings, no exception/request-text log on shadow failure, identity-field rejection, and no legacy persistence or Qwen call.
- Python v0.2 policy and calibration tests: 11 passed without a model or database.
- Neon schema inserts, constraints, cascade, and cleanup were tested against the disposable branch above.

The 2026-09-25 follow-up adds the streamed response cap, a dependency-injected scheduled-flow boundary test, shadow-only safe-default config, a separate default-off gate for legacy `/internal/depth/evaluate`, and documentation corrections. Current exact-head CI and Preview evidence will be appended after this commit completes.

The caller defaults off, and this change does not configure a Preview model endpoint or service token. Preview verification covers the ordinary application routes and the code-level disabled path; it does not claim a live model call. Production, the default Neon branch, Qwen, and Closed Alpha readiness remain outside this change.
