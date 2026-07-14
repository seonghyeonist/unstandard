# Supabase → Neon Cutover Record (P0.3A)

Honest historical and operational migration record for PR #55.

Baselines inspected (read-only):

| Role | Ref |
|------|-----|
| Source baseline | `main` @ `4bb6fda10db4605605af66e2710ac8e7ac9ace2e` |
| Target branch | `cursor/neon-drizzle-better-auth-rebuild-909d` (this PR HEAD) |

This document is an **audit**. It is **not** a declaration of migration completion.

Statuses used below (only):

`REMOVED` · `IMPLEMENTED` · `VERIFIED` · `BLOCKED_EXTERNAL` · `NOT_STARTED` · `NOT_APPLICABLE` · `DECISION_REQUIRED`

---

## Executive status

| Layer | Status |
|-------|--------|
| Active runtime code path away from retired BaaS | `IMPLEMENTED` |
| Neon + Drizzle + Better Auth relational code | `IMPLEMENTED` |
| External Neon staging/production bootstrap | `BLOCKED_EXTERNAL` |
| External legacy data migration | `NOT_STARTED` / `DECISION_REQUIRED` |
| External identity migration / remapping | `DECISION_REQUIRED` |
| Preview runtime proof with credentials | `BLOCKED_EXTERNAL` |
| Production cutover | `NOT_STARTED` |

**Do not say “migration complete”.**

Neon is the relational closed-alpha database. Neon/pgvector is **not** automatically the permanent vector database (see `docs/PERSISTENCE_BOUNDARY.md`).

---

## Domain matrix

### Authentication

| Field | Value |
|-------|-------|
| Previous owner/platform | Supabase Auth (magic-link / OAuth routes on `main`) |
| Current target | Better Auth (self-hosted) + Drizzle auth tables |
| Code-path status | `IMPLEMENTED` (runtime Supabase auth routes `REMOVED`) |
| Schema status | `IMPLEMENTED` (`users` / `sessions` / `accounts` / `verifications`) |
| External migration status | `BLOCKED_EXTERNAL` / `DECISION_REQUIRED` |
| Identity-mapping requirement | Old Supabase user IDs ≠ Better Auth user IDs unless an explicit map is built |
| Validation still required | Login/logout Preview smoke; invite finalize; session revocation proofs |
| Rollback concern | Re-enabling retired Auth without env + identity map would orphan sessions |

### Sessions

| Field | Value |
|-------|-------|
| Previous | Supabase session cookies / SSR helpers |
| Current | Better Auth session cookies + `/api/auth/session` redaction |
| Code-path | `IMPLEMENTED` |
| Schema | `IMPLEMENTED` (`sessions`) |
| External | `BLOCKED_EXTERNAL` (Preview A/B proofs) |
| Identity map | Session subject is Better Auth `users.id` |
| Validation | stale-cookie revocation; logout flow |
| Rollback | Concurrent dual session authorities must not coexist |

### Users

| Field | Value |
|-------|-------|
| Previous | Supabase `auth.users` |
| Current | Better Auth `users` (+ `invite_finalized_at`) |
| Code-path | `IMPLEMENTED` |
| Schema | `IMPLEMENTED` |
| External data | `NOT_STARTED` |
| Identity map | `DECISION_REQUIRED` — do not assume UUID equality |
| Validation | invite gate + finalize |
| Rollback | wiping Production users without archive |

### Profiles

| Field | Value |
|-------|-------|
| Previous | app tables via Supabase adapters |
| Current | Drizzle `profiles` / `profile_private` |
| Code-path | `IMPLEMENTED` for repositories; private HTTP route still **mock + unlock cookie** |
| Schema | `IMPLEMENTED` |
| External | `NOT_STARTED` |
| ID map | profile UUID namespace is application-owned; not interchangeable with auth user id |
| Validation | DB-backed private route still `NOT_APPLICABLE` / future |
| Rollback | profile_private payload migration if any legacy rows exist |

### Questions / Answers

| Field | Value |
|-------|-------|
| Previous | mixed mock + planned persistence |
| Current | Drizzle `questions` / `answers` / `depth_evaluations` + seed |
| Code-path | `IMPLEMENTED` repositories; product AI Depth Score still mock-gated |
| Schema | `IMPLEMENTED` |
| External | `NOT_STARTED` |
| Validation | seed state idempotency (code); real DB `BLOCKED_EXTERNAL` |
| Rollback | seed conflicts if legacy question IDs collide |

### Reports / Blocks / Unlocks

| Field | Value |
|-------|-------|
| Previous | in-memory / Supabase adapters on `main` lineage |
| Current | Drizzle repositories + SQL uniqueness / FK |
| Code-path | `IMPLEMENTED` |
| Schema | `IMPLEMENTED` |
| External verification | `BLOCKED_EXTERNAL` |
| Identity | `reporter_user_id` = Better Auth user id (not profile id) |
| Validation | integration cases; Preview report smoke |
| Rollback | OPEN report dedupe keys must match actor model |

### Invites

| Field | Value |
|-------|-------|
| Previous | `NOT_APPLICABLE` / not the same closed-alpha invite model |
| Current | `alpha_invites` + ticket + finalize transaction |
| Code-path | `IMPLEMENTED` |
| Schema | `IMPLEMENTED` |
| External | `BLOCKED_EXTERNAL` (issue real invites on staging) |
| Validation | concurrency + finalize success/rollback integration |
| Rollback | reserved invite compensation path |

### Environment variables

| Field | Value |
|-------|-------|
| Previous | `NEXT_PUBLIC_SUPABASE_*`, service role, etc. |
| Current | `DATABASE_URL`, `BETTER_AUTH_*`, `AUTH_COOKIE_SECRET`, `UNSTANDARD_*` |
| Code-path | `IMPLEMENTED` (`.env.example` active vars) |
| External Vercel env cutover | `BLOCKED_EXTERNAL` (no env mutation in this task) |
| Validation | Preview auth diagnostics |
| Rollback | dual env presence risks dual backends — forbidden |

### Migrations

| Field | Value |
|-------|-------|
| Previous | `supabase/migrations/*` on baseline |
| Current | `drizzle/migrations` + shared ledger contract (`drizzle.__drizzle_migrations`) |
| Code-path | `IMPLEMENTED` |
| Schema | `IMPLEMENTED` |
| External apply on Neon | `BLOCKED_EXTERNAL` |
| Validation | second-run no-op via ledger + schema fingerprint (code); needs `TEST_DATABASE_URL` |
| Rollback | do not apply drizzle migrations to Production without confirmation gates |

### Deployment workflows

| Field | Value |
|-------|-------|
| Previous | Vercel + Supabase-oriented smoke docs |
| Current | Rebuild CI Node 24.x; canonical Preview `unstandard-m9qj` |
| Code-path | `IMPLEMENTED` |
| External Preview READY proof | `BLOCKED_EXTERNAL` without operator smoke creds |
| Production cutover | `NOT_STARTED` |
| Rollback | Production aliases untouched by this PR |

### Authorization / RLS assumptions

| Field | Value |
|-------|-------|
| Previous | Supabase RLS policies (`0002_rls_policies.sql` on baseline) |
| Current | Application authorization + SQL constraints (no browser→DB) |
| Code-path | `IMPLEMENTED` |
| Schema RLS | `NOT_APPLICABLE` as primary alpha control (server-only DB) |
| External | `BLOCKED_EXTERNAL` adversarial HTTP smoke |
| Rollback | never reintroduce client service-role paths |

### User-ID / Profile-ID mapping

| Field | Value |
|-------|-------|
| Status | `DECISION_REQUIRED` |
| Note | Legacy auth user IDs must not be copied blindly into Better Auth `users.id`. Profile IDs are a separate namespace. |

### External data / external user accounts

| Field | Value |
|-------|-------|
| External data migration | `NOT_STARTED` |
| External account activation | `DECISION_REQUIRED` |
| Validation | row counts / FK / duplicates — not executed |

---

## Data and identity cutover options

### Option A — Controlled data and identity migration

Requires:

1. Source-schema inspection of legacy Supabase tables
2. Export procedure (sanitized)
3. Explicit identity mapping table (old auth id → new Better Auth id)
4. Target import into Neon/Drizzle schema
5. Row-count reconciliation
6. FK validation
7. Duplicate handling rules
8. Account activation strategy
9. Rollback plan

Status: `NOT_STARTED` · Decision: `DECISION_REQUIRED`

### Option B — Clean closed-alpha reset and re-invitation

Requires:

1. Confirmation that legacy data may be discarded
2. Explicit founder decision (written)
3. Archive/export decision
4. New Better Auth accounts
5. New invite issuance
6. Communication plan
7. Production cutover window

Status: `NOT_STARTED` · Decision: `DECISION_REQUIRED`

**No silent data destruction.** Repository evidence does **not** conclusively prove that no meaningful external user data exists in previous environments; therefore the choice remains `DECISION_REQUIRED`.

---

## Vector infrastructure boundary

- Operational **relational** data may use Neon.
- Depth Score remains behind a scoring interface.
- Embeddings remain behind a vector-store interface.
- Semantic retrieval remains behind a retrieval adapter.
- UI/product routes must not import provider-specific vector primitives.
- pgvector may remain a PoC option only.
- **No permanent vector provider is selected in this task.**

---

## Guard meaning

`npm run guard:no-legacy-backend` PASS means:

> No active runtime or current deployment path depends on the retired platform.

It does **not** mean the repository contains no historical mention of that platform.
Historical mentions are limited to this file and `docs/LEGACY_BACKEND_RETIREMENT.md`.
