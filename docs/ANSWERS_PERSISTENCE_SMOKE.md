# Answers Persistence Smoke — P0 (Onboarding)

> **Status:** CODE READY — **DB/RLS NOT VERIFIED** until human applies migrations and runs smoke.  
> **Alpha verdict:** **BLOCKED** — this slice alone does not unblock alpha.

## Scope

This slice replaces **onboarding answer** `sessionStorage` persistence with optional DB-backed storage when:

```env
ANSWERS_PERSISTENCE_ADAPTER=supabase-alpha
```

Plus existing `UNSTANDARD_SUPABASE_URL` + `UNSTANDARD_SUPABASE_PUBLISHABLE_KEY`.

**Out of scope (still fake):**

- Unlock-flow answers (`POST /api/answers/unlock`) — still cookie-only, mock profile slugs
- Unlock DB source of truth
- Blocks
- Rate limiting

## Required migrations (human — apply in order)

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_reports_dedup_index.sql` (reports only; safe to apply before answers smoke)
4. `supabase/migrations/0004_onboarding_question_seed.sql` — **required** for answers FK

Rollback (destructive — staging only):

```sql
DELETE FROM public.depth_evaluations WHERE answer_id IN (
  SELECT id FROM public.answers WHERE question_id = '22222222-2222-2222-2222-222222222222'
);
DELETE FROM public.answers WHERE question_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM public.questions WHERE id = '22222222-2222-2222-2222-222222222222';
```

## RLS expectations

Uses existing policies in `0002_rls_policies.sql`:

| Table | Policy | Expectation |
|-------|--------|-------------|
| `profiles` | `profiles_insert_own` / `profiles_update_own` | User upserts own profile + `onboarded_at` |
| `answers` | `answers_insert_own` / `answers_select_own` | User inserts/reads own onboarding answer only |
| `depth_evaluations` | `depth_evaluations_insert_own` | User inserts evaluation for own answer |

**Not logged:** raw `answer_text`, email, tokens, full UUIDs in application logs.

## Vercel env (names only)

| Variable | Required when enabling |
|----------|------------------------|
| `UNSTANDARD_SUPABASE_URL` | ✅ |
| `UNSTANDARD_SUPABASE_PUBLISHABLE_KEY` | ✅ |
| `AUTH_COOKIE_SECRET` | ✅ (production) |
| `ANSWERS_PERSISTENCE_ADAPTER` | ✅ set to `supabase-alpha` |
| `UNSTANDARD_APP_URL` | ✅ for auth callback alignment |

**Do not set:**

- `SUPABASE_SERVICE_ROLE_KEY` for this path (user-scoped publishable key + RLS only)

## Smoke cases (after P0-5 auth smoke resumes)

| # | Case | Expected |
|---|------|----------|
| 1 | Supabase login + `ANSWERS_PERSISTENCE_ADAPTER=supabase-alpha` | `/api/auth/session` → `onboarded: false` until onboarding |
| 2 | Submit onboarding form | `POST /api/onboarding/answer` → 201; profile `onboarded_at` set |
| 3 | Session after onboarding | `GET /api/auth/session` → `onboarded: true`, nickname from profile |
| 4 | Re-submit onboarding | 200 duplicate (idempotent) |
| 5 | RLS adversarial | User B cannot `SELECT` user A's `answers` row |

## Code map

| Path | Role |
|------|------|
| `lib/config/answers-persistence-mode.ts` | Explicit adapter gate |
| `lib/server/persistence/answers.repository.*` | Repository boundary |
| `lib/server/persistence/adapters/supabase/answers.repository.ts` | Alpha adapter |
| `app/onboarding/actions.ts` | Server-side persist branch |
| `app/api/onboarding/answer/route.ts` | HTTP entry (Supabase auth only) |
| `lib/server/profile/profile-session.ts` | Loads `onboarded_at` for session |
