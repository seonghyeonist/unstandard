# Local AI v0.2 shadow integration

Date: 2026-09-24

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
- duplicate `(unlock_attempt_id, model_version)` insertion is ignored by the unique constraint;
- an out-of-range score and a missing attempt foreign key are rejected;
- deleting the synthetic canonical attempt cascades its shadow row;
- cleanup readback returned zero shadow rows, attempts, synthetic users, and synthetic questions.

The default Neon branch was inspected to confirm its identity and was not written. Production/default database state was not changed.

## Server-only caller and scorer boundary

The caller is imported only from the server-side database unlock service. It schedules a best-effort callback with Next.js `after()`, after the authoritative transaction commits. It requires all of:

- `UNSTANDARD_LOCAL_AI_SHADOW_ENABLED=true`;
- an HTTPS `UNSTANDARD_LOCAL_AI_SHADOW_URL` ending at `/internal/depth/shadow-evaluate`;
- `UNSTANDARD_LOCAL_AI_SHADOW_TOKEN` from server secret storage.

Without all three, it schedules no request. Requests use the service-only `X-Unstandard-Depth-Service-Token` header, a 1.5-second timeout, no retry, no redirects, and a bounded response size. Logs contain only stable failure codes.

The dedicated Python route rejects caller identity fields and performs no database persistence, embedding persistence, or Qwen request. It returns only a scoring result and feature data. The Next.js caller validates the version and response shape, then writes only the allowlisted derived fields to the canonical shadow table. No client configuration or user-facing Local AI result is added.

The service result version is `local-v0.2+bge-m3`. The shadow schema does not store embeddings or any text. The Local AI result and any service failure are ignored for unlock behavior.

## Verification

- Local `npm run check`: lint, typecheck, all 373 Node tests, and production build passed.
- Local shadow invariant test: authoritative PASS/REVIEW/REJECT results stay identical when shadow returns PASS/REVIEW/REJECT or fails by timeout, HTTP 500, malformed response, or network error.
- Python depth-service tests: 26 passed, including missing service auth before embeddings, no exception/request-text log on shadow failure, identity-field rejection, and no legacy persistence or Qwen call.
- Python v0.2 policy and calibration tests: 11 passed without a model or database.
- Neon schema inserts, constraints, cascade, and cleanup were tested against the disposable branch above.

Exact-head GitHub CI and Preview deployment evidence are recorded in the stacked integration PR description after publication.

The caller defaults off, and this change does not configure a Preview model endpoint or service token. Preview verification covers the ordinary application routes and the code-level disabled path; it does not claim a live model call. Production, the default Neon branch, Qwen, and Closed Alpha readiness remain outside this change.
