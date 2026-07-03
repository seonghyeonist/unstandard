# Answers Persistence Smoke — P0 (Onboarding)

> **Status:** CODE READY — **DB/RLS NOT VERIFIED** until human applies migrations and runs smoke.  
> **Alpha verdict:** **BLOCKED** — this slice alone does not unblock alpha.  
> **Execution runbook:** [`ANSWERS_RLS_ADVERSARIAL_SMOKE.md`](./ANSWERS_RLS_ADVERSARIAL_SMOKE.md) (migration order, RLS matrix, evidence, rollback).

## Canonical target lock

Evidence and smoke must use only:
- Vercel project: `unstandard-m9qj`
- Host: `https://unstandard-m9qj.vercel.app`
- Callback: `https://unstandard-m9qj.vercel.app/auth/callback`

P0-5 login/logout/protected-route smoke has **manually passed** on canonical `unstandard-m9qj`.  
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
| **2. App preview** | §G onboarding on `unstandard-m9qj` | Enable only after Phase 1 **PASS** | After Phase 1 **PASS**, before or after merge per founder |
| **3. Merge decision** | Founder review | — | Only after Phase 1 **PASS** (Phase 2 optional gate) |

**Current step:** Phase 1 planning/execution — see [`ANSWERS_RLS_ADVERSARIAL_SMOKE.md`](./ANSWERS_RLS_ADVERSARIAL_SMOKE.md).

## Required migrations (human — apply in order)

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_reports_dedup_index.sql`
4. `supabase/migrations/0004_onboarding_question_seed.sql`
5. `supabase/migrations/0005_answers_onboarding_hardening.sql`

Pin PR #30 head: `f795038533ea4cfe55bd71fdb59de68eb97e69fc`

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
| `UNSTANDARD_APP_URL` | `https://unstandard-m9qj.vercel.app` | Same |

**Do not set:** `SUPABASE_SERVICE_ROLE_KEY` for user paths.

## App smoke cases (Phase 2 only — after §F PASS)

| # | Case | Expected |
|---|------|----------|
| G3 | Login on `unstandard-m9qj` + adapter enabled | `onboarded: false` until onboarding |
| G4 | Submit onboarding | 201; `onboarded_at` only after answer+evaluation |
| G5 | Session after onboarding | `onboarded: true` |
| G6 | Re-submit | 200 duplicate |
| G7 | Logout / protected route | 307 → `/login` (P0-5 regression) |

## Code map

| Path | Role |
|------|------|
| `lib/config/answers-persistence-mode.ts` | Explicit adapter gate |
| `lib/server/persistence/onboarding-finalize.ts` | Onboarded finalize gate |
| `lib/server/persistence/adapters/supabase/answers.repository.ts` | Alpha adapter (safe write order) |
| `app/onboarding/actions.ts` | Server-side persist branch |
| `app/api/onboarding/answer/route.ts` | HTTP entry (Supabase auth only) |
