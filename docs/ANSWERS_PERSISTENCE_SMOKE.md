# Answers Persistence Smoke — P0 (Onboarding)

> **Status:** CODE READY — **DB/RLS NOT VERIFIED** until human applies migrations and runs smoke.  
> **Alpha verdict:** **BLOCKED** — this slice alone does not unblock alpha.

## Canonical target lock

Evidence and smoke must use only:
- Vercel project: `unstandard-m9qj`
- Host: `https://unstandard-m9qj.vercel.app`
- Callback: `https://unstandard-m9qj.vercel.app/auth/callback`

P0-5 login/logout/protected-route smoke has **manually passed** on canonical `unstandard-m9qj`.  
**Do not enable** `ANSWERS_PERSISTENCE_ADAPTER` until migrations **and** RLS adversarial smoke pass.

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

## Required migrations (human — apply in order)

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_reports_dedup_index.sql` (reports only; safe before answers smoke)
4. `supabase/migrations/0004_onboarding_question_seed.sql` — **required** for answers FK
5. `supabase/migrations/0005_answers_onboarding_hardening.sql` — unique index + hardened RLS insert policies

Rollback (destructive — staging only):

```sql
DELETE FROM public.depth_evaluations WHERE answer_id IN (
  SELECT id FROM public.answers WHERE question_id = '22222222-2222-2222-2222-222222222222'
);
DELETE FROM public.answers WHERE question_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM public.questions WHERE id = '22222222-2222-2222-2222-222222222222';
```

## RLS expectations

Base policies: `0002_rls_policies.sql`  
Hardened onboarding inserts: `0005_answers_onboarding_hardening.sql`

| Table | Policy | Expectation |
|-------|--------|-------------|
| `profiles` | `profiles_insert_own` / `profiles_update_own` | User upserts own profile; `onboarded_at` only after answer+evaluation persist |
| `answers` | `answers_insert_own` (0005) | `user_id` and `target_profile_id` must equal `auth.uid()` |
| `answers` | `idx_answers_user_question_unique` | One row per `(user_id, question_id)` |
| `depth_evaluations` | `depth_evaluations_insert_own` (0005) | `answer_id` must belong to `auth.uid()` |

**Runtime RLS adversarial smoke still required** (User A vs User B) after migrations apply.

**Not logged:** raw `answer_text`, email, tokens, full UUIDs in application logs.

## Vercel env (names only)

| Variable | Required when enabling |
|----------|------------------------|
| `UNSTANDARD_SUPABASE_URL` | ✅ |
| `UNSTANDARD_SUPABASE_PUBLISHABLE_KEY` | ✅ |
| `AUTH_COOKIE_SECRET` | ✅ (production) |
| `ANSWERS_PERSISTENCE_ADAPTER` | ✅ set to `supabase-alpha` **only after migration + RLS smoke** |
| `UNSTANDARD_APP_URL` | ✅ `https://unstandard-m9qj.vercel.app` |

**Do not set:**

- `SUPABASE_SERVICE_ROLE_KEY` for this path (user-scoped publishable key + RLS only)

## Smoke cases (after migrations 0001–0005 applied)

| # | Case | Expected |
|---|------|----------|
| 1 | Supabase login on `unstandard-m9qj` + adapter enabled | `/api/auth/session` → `onboarded: false` until onboarding |
| 2 | Submit onboarding form | `POST /api/onboarding/answer` → 201; profile `onboarded_at` set **only after** answer+evaluation |
| 3 | Session after onboarding | `GET /api/auth/session` → `onboarded: true`, nickname from profile |
| 4 | Re-submit onboarding | 200 duplicate (idempotent) |
| 5 | RLS adversarial | User B cannot `SELECT` user A's `answers` row |
| 6 | RLS adversarial insert | User B cannot insert answer with `target_profile_id` = User A |
| 7 | RLS adversarial evaluation | User B cannot insert `depth_evaluations` for User A's `answer_id` |

## Code map

| Path | Role |
|------|------|
| `lib/config/answers-persistence-mode.ts` | Explicit adapter gate |
| `lib/server/persistence/onboarding-finalize.ts` | Onboarded finalize gate |
| `lib/server/persistence/answers.repository.*` | Repository boundary |
| `lib/server/persistence/adapters/supabase/answers.repository.ts` | Alpha adapter (safe write order) |
| `app/onboarding/actions.ts` | Server-side persist branch |
| `app/api/onboarding/answer/route.ts` | HTTP entry (Supabase auth only) |
| `lib/server/profile/profile-session.ts` | Loads `onboarded_at` for session |
