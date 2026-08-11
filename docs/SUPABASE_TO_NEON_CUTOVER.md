# Supabase → Neon Cutover Record (P0.3A)

status: HISTORICAL_AUDIT_NOT_EXECUTABLE

Honest historical and operational migration record for PR #55.
This file is a reviewed historical audit only — not executable operator instructions.

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
| Founder data/identity cutover decision | **OPTION B+ RECORDED** (clean reset + read-only archive policy) |
| External legacy data direct migrate into closed-alpha runtime | `NOT_APPLICABLE` under Option B+ (do not migrate) |
| Legacy read-only export/archive | `NOT_STARTED` (do not claim complete until created and verified) |
| External identity migration into Better Auth | `NOT_APPLICABLE` under Option B+ (do not migrate; new accounts) |
| Preview runtime proof with credentials | `BLOCKED_EXTERNAL` |
| Production cutover | `NOT_STARTED` |

**Do not say “migration complete”.**
**Do not say “alpha-ready”** from documentation alone, or from proof-harness PASS alone while other P0 gates remain open.

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
| External migration status | `NOT_APPLICABLE` under **OPTION B+** (no identity migrate) |
| Identity-mapping requirement | Old and new user IDs are **not** interchangeable; closed alpha starts with new Better Auth accounts |
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
| Identity map | **OPTION B+** — no UUID equality; new accounts only |
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
| Validation | second-run no-op via ledger + canonical schema snapshot + schemaContentDigest (code); needs `TEST_DATABASE_URL` |
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
| Status | **OPTION B+ RECORDED** |
| Note | Do not migrate Supabase identities into Better Auth. Do not assume old and new user IDs are interchangeable. Profile IDs remain a separate application namespace. Closed alpha starts with new accounts and new invites. |

### External data / external user accounts

| Field | Value |
|-------|-------|
| Direct legacy → Neon application-row migrate | `NOT_APPLICABLE` (Option B+) |
| Legacy read-only export/archive | `NOT_STARTED` (separate process; not claimed complete) |
| External account activation | New Better Auth accounts + new invites only; issuance still `BLOCKED_EXTERNAL` until Preview bootstrap |
| Validation | row counts / FK / duplicates for a migrate path — not executed (path rejected) |

---

## Data and identity cutover options

### OPTION B+ — Clean reset with read-only archive (FOUNDER DECISION — RECORDED)

**Decision status:** `RECORDED` (founder-directed for PR #55 / closed-alpha path).

#### DATA CUTOVER

- Do **not** directly migrate legacy Supabase application rows into the new closed-alpha runtime.
- Do **not** delete legacy data in this task.
- If legacy data must be retained, preserve it through a **separate** read-only export/archive process.
- Do **not** claim the archive is complete unless it has actually been created and verified.
- Archive status today: `NOT_STARTED`.

#### IDENTITY CUTOVER

- Do **not** migrate Supabase identities into Better Auth.
- Do **not** assume old and new user IDs are interchangeable.
- Start the Neon + Better Auth closed alpha with **new accounts** and **new invites**.

#### PRODUCTION

- Production cutover remains `NOT_STARTED`.
- No Production DB or Vercel Production change is authorized by this decision alone.

#### Still blocked / incomplete (decision does not complete these)

- Disposable integration PostgreSQL evidence (`TEST_DATABASE_URL`) — `BLOCKED_EXTERNAL` until run
- Preview DB bootstrap + migrate/seed — `BLOCKED_EXTERNAL` until run
- Authenticated Preview A/B smoke — `BLOCKED_EXTERNAL` until run
- Combined readiness machine artifact — `BLOCKED_EXTERNAL` until run
- Overall closed-alpha launch readiness — remains **BLOCKED** / `BLOCKED_EXTERNAL` while any P0 gate is open
- Proof-harness `readiness:alpha` PASS ≠ overall product alpha-ready

### Option A — Controlled data and identity migration (NOT SELECTED)

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

Status: `NOT_SELECTED` (superseded by Option B+)

### Option B — Clean closed-alpha reset and re-invitation (superseded by B+)

Requires:

1. Confirmation that legacy data may be discarded
2. Explicit founder decision (written)
3. Archive/export decision
4. New Better Auth accounts
5. New invite issuance
6. Communication plan
7. Production cutover window

Status: `SUPERSEDED` by **OPTION B+** (adds explicit read-only archive policy; still no silent destruction)

**No silent data destruction.** Option B+ forbids deleting legacy data in this task and forbids claiming an unverified archive.

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

> Within the printed inspected inventory (tracked file count, active files inspected,
> exact historical files excluded), no active runtime or current deployment path
> depends on the retired platform.

It does **not** mean the repository contains no historical mention of that platform.
Historical mentions are limited to the exact allowlisted audit documents
(`docs/SUPABASE_TO_NEON_CUTOVER.md`, `docs/LEGACY_BACKEND_RETIREMENT.md`), each of which
must carry `status: HISTORICAL_AUDIT_NOT_EXECUTABLE`.
There is no directory-prefix exemption under `lib/`. Root operator files
(`vercel.json`, `Dockerfile*`, `*.cmd` / `*.ps1` / `*.sh`, etc.) are in scope.
