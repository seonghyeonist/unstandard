# Answers Persistence Smoke — P0 (Onboarding)

> **Status:** CODE READY — **DB/RLS NOT VERIFIED** until human applies migrations and runs smoke.  
> **Alpha verdict:** **BLOCKED** — this slice alone does not unblock alpha.  
> **Execution runbook:** [`ANSWERS_RLS_ADVERSARIAL_SMOKE.md`](./ANSWERS_RLS_ADVERSARIAL_SMOKE.md) (migration order, RLS matrix, evidence, rollback).

## Environment target matrix (founder-finalized)

| Vercel environment | Supabase project | DB purpose | Auth callback domain | PR #30 evidence? | Adapter enable? |
|--------------------|------------------|------------|----------------------|------------------|-----------------|
| **Preview** | Unstandard-staging | Staging / migration + RLS smoke | `https://<preview-host>/auth/callback` | **Yes** — Phase 1 DB + Phase 2 app smoke | **No** until §F PASS + founder approval |
| **Production** | Main (prod) | Production — **untouchable** for PR #30 | `https://<production-host>/auth/callback` | **No** for PR #30 migration/RLS | **No** |

**P0-5 historical lock (separate):** login/logout smoke **manually passed** on `unstandard-m9qj` Production host — see [`STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md). That record does **not** authorize PR #30 migrations on prod DB or adapter enable on Production.

**Invalid evidence:** `unstandard`, `unstandard-f3nf`, `unstandard-fabi`, or any other Vercel project (unless founder reassigns in writing).

**Do not enable** `ANSWERS_PERSISTENCE_ADAPTER` until **direct RLS adversarial smoke (§F)** passes per linked runbook.

## Scope

This slice replaces **onboarding answer** `sessionStorage` persistence with optional DB-backed storage when:

```env
ANSWERS_PERSISTENCE_ADAPTER=supabase-alpha
```

Plus existing `UNSTANDARD_SUPABASE_URL` + `UNSTANDARD_SUPABASE_PUBLISHABLE_KEY`.

**Out of scope (still fake / BLOCKED):**

- Unlock-flow answers (`POST /api/answers/unlock`) — still cookie-only
- Unlock DB source of truth
- Blocks
- Rate limiting
- Reports DB/RLS smoke (separate gate)
- Full alpha readiness
- **Merge PR #30** (separate decision after smoke)

## Smoke phases (strict order)

| Phase | What | Adapter | Merge PR #30 |
|-------|------|---------|--------------|
| **1. Direct DB** | Apply `0001`–`0005`, §D schema + §F RLS adversarial | **Disabled** | Not required |
| **2. App preview** | §G onboarding on **Vercel Preview** + staging Supabase | Enable only after Phase 1 **PASS** | After Phase 1 **PASS**, before or after merge per founder |
| **3. Merge decision** | Founder review | — | Only after Phase 1 **PASS** (Phase 2 optional gate) |

**Current step:** Phase 1 planning/execution — see [`ANSWERS_RLS_ADVERSARIAL_SMOKE.md`](./ANSWERS_RLS_ADVERSARIAL_SMOKE.md).

## Required migrations (human — apply in order)

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_reports_dedup_index.sql`
4. `supabase/migrations/0004_onboarding_question_seed.sql`
5. `supabase/migrations/0005_answers_onboarding_hardening.sql`

Pin PR #30 head: `0dae7c987db01b654b69878643d82ea64ae419da`
Base `main` SHA (merge target): `12ccb77395858a3778ace4d61693bc4b29f8c503`

> This pin is for evidence/rollback/smoke traceability only. It is not merge approval.

## RLS expectations (runtime proof required)

| Table | Policy / object | Expectation |
|-------|-----------------|-------------|
| `profiles` | `profiles_insert_own` / `profiles_update_own` | Own row only |
| `answers` | `answers_insert_own` (0005) | `user_id` = `target_profile_id` = `auth.uid()` |
| `answers` | `idx_answers_user_question_unique` | One row per `(user_id, question_id)` |
| `depth_evaluations` | `depth_evaluations_insert_own` (0005) | `answer_id` must belong to `auth.uid()` |

Adversarial cases F1–F11: linked runbook §F.

## Vercel env (names only)

| Variable | Phase 1 (RLS smoke) | Phase 2 (app smoke) |
|----------|----------------------|---------------------|
| `ANSWERS_PERSISTENCE_ADAPTER` | **Disabled / unset** | `supabase-alpha` after §F PASS |
| `UNSTANDARD_SUPABASE_URL` | Set (auth) | Set |
| `UNSTANDARD_SUPABASE_PUBLISHABLE_KEY` | Set | Set |
| `UNSTANDARD_APP_URL` | Exact **Preview** deployment origin | Same |

**Do not set:** `SUPABASE_SERVICE_ROLE_KEY` for user paths.

## App smoke cases (Phase 2 only — after §F PASS)

| # | Case | Expected |
|---|------|----------|
| G3 | Login on **Vercel Preview** + adapter enabled | `onboarded: false` until onboarding |
| G4 | Submit onboarding | 201; `onboarded_at` only after answer+evaluation |
| G5 | Session after onboarding | `onboarded: true` |
| G6 | Re-submit | 200 duplicate |
| G7 | Logout / protected route | 307 → `/login` (P0-5 regression on Preview) |

## Code map

| Path | Role |
|------|------|
| `lib/config/answers-persistence-mode.ts` | Explicit adapter gate |
| `lib/server/persistence/onboarding-finalize.ts` | Onboarded finalize gate |
| `lib/server/persistence/adapters/supabase/answers.repository.ts` | Alpha adapter (safe write order) |
| `app/onboarding/actions.ts` | Server-side persist branch |
| `app/api/onboarding/answer/route.ts` | HTTP entry (Supabase auth only) |
