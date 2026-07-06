# Answers RLS Adversarial Smoke — Execution Runbook (PR #30)

> **Task:** Staging-only direct migration + RLS adversarial smoke for PR #30 onboarding answers.
> **PR #30 head SHA (pin before run):** `0dae7c987db01b654b69878643d82ea64ae419da`
> **Base `main` SHA (merge target):** `12ccb77395858a3778ace4d61693bc4b29f8c503`
> **Branch:** `cursor/db-backed-answers-8eec`
> **Alpha verdict:** **BLOCKED** — this runbook does not change that.
> **Pin note:** This pin is for evidence/rollback/smoke traceability only. It is not merge approval.

Related:
- [`ANSWERS_PERSISTENCE_SMOKE.md`](./ANSWERS_PERSISTENCE_SMOKE.md) — app-level smoke (later phase)
- [`STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md) — P0-5 auth (passed on canonical target)
- [`ALPHA_READINESS_CHECKLIST.md`](./ALPHA_READINESS_CHECKLIST.md)

---

## A. Scope and non-scope

### In scope (staging only)

- Apply migrations `0001` → `0005` from PR #30 to **staging Supabase** (human executes).
- Validate schema, RLS enabled, policies, unique index, seed row.
- Adversarial RLS tests with **User A** and **User B** via **authenticated client** (not service role).
- Record evidence in the template below (redacted).

### Explicit non-scope

| Item | Status |
|------|--------|
| Alpha readiness | **NOT claimed** |
| Merge PR #30 | **NOT in this run** |
| Enable `ANSWERS_PERSISTENCE_ADAPTER` | **NOT during direct RLS smoke** |
| Vercel env changes | **NOT during direct RLS smoke** |
| Unlock DB source of truth | Out of scope |
| Blocks API/DB | Out of scope |
| Reports DB/RLS smoke | Separate gate |
| Rate limiting / abuse guard | Out of scope |
| Production Supabase / production Vercel | **ABORT if detected** |

### Environment target (app smoke phase only — not direct DB phase)

| Field | Preview (PR #30 app smoke) | Production |
|-------|---------------------------|------------|
| Vercel environment | **Preview** | Production — **not for PR #30** |
| Supabase project | **Unstandard-staging** | Main (prod) — **ABORT** |
| Host | `https://<preview-deployment-host>` | Do not use for PR #30 |
| Callback | `https://<preview-host>/auth/callback` | — |
| `UNSTANDARD_APP_URL` | Exact Preview origin | — |

**P0-5 historical evidence** on `unstandard-m9qj` Production host is valid for login smoke only — not interchangeable with PR #30 staging migration evidence.

**Invalid evidence:** `unstandard`, `unstandard-f3nf`, `unstandard-fabi`, any other Vercel project; Production Vercel + prod Supabase for PR #30 work.

---

## B. Preconditions checklist (human — all must pass before migration 0001)

| # | Check | Pass | Evidence |
|---|-------|------|----------|
| P1 | Supabase project is **staging**, not production | ☐ | Dashboard project name (redacted) |
| P2 | Founder confirms staging project ref matches Vercel **Preview** `UNSTANDARD_SUPABASE_URL` | ☐ | Env var **name** only on Vercel Preview |
| P3 | PR #30 head SHA = `0dae7c987db01b654b69878643d82ea64ae419da` | ☐ | `git rev-parse origin/cursor/db-backed-answers-8eec` |
| P4 | Local migration files match PR #30 (`0001`–`0005` in repo at that SHA) | ☐ | `git show 0dae7c9:supabase/migrations/` |
| P5 | Rollback posture agreed (§H) — founder approval to proceed | ☐ | Sign-off |
| P6 | **User A** exists — disposable email `staging-a+*@...` | ☐ | User id prefix only in log |
| P7 | **User B** exists — disposable email `staging-b+*@...` | ☐ | User id prefix only in log |
| P8 | Record User A UUID and User B UUID locally (not in git) | ☐ | Local secure note |
| P9 | Staging has **no irreplaceable real user data**, or data inventory recorded | ☐ | Note |
| P10 | `ANSWERS_PERSISTENCE_ADAPTER` **unset or disabled** on Vercel **Preview** | ☐ | Vercel Preview env screenshot (values redacted) |
| P11 | `SUPABASE_SERVICE_ROLE_KEY` **not** added to Vercel for this smoke | ☐ | Env names only |
| P12 | P0-5 auth smoke passed on `unstandard-m9qj` (login/logout/protected route) | ☐ | [`STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md) |

**ABORT if:** production project, wrong Vercel project, PR SHA mismatch, or service role required for user paths.

---

## C. Migration application plan (human executes — agent does NOT apply)

Apply **in order**. Stop on first failure. Record each step in §I evidence table.

### 0001 — `0001_initial_schema.sql`

| Field | Value |
|-------|--------|
| Purpose | Core tables: profiles, questions, answers, depth_evaluations, reports, blocks, … |
| Objects | Tables, indexes, FKs, `pgcrypto` extension |
| Additive | Yes (`IF NOT EXISTS` on tables) |
| Rollback difficulty | **High** — `DROP TABLE ... CASCADE` (staging only) |
| Validation | §D.1 |
| Failure means | Schema incomplete — **STOP**, do not apply 0002+ |
| Stop condition | Any `ERROR` in SQL editor or CLI |

### 0002 — `0002_rls_policies.sql`

| Field | Value |
|-------|--------|
| Purpose | Enable RLS + base policies on all private tables |
| Objects | `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY` (base `answers_insert_own` superseded by 0005) |
| Additive | Yes (policies created; 0005 replaces two insert policies) |
| Rollback difficulty | Medium — `DROP POLICY` per table |
| Validation | §D.2 |
| Failure means | RLS not active — **STOP** |
| Stop condition | Policy creation error or RLS disabled on answers/profiles |

### 0003 — `0003_reports_dedup_index.sql`

| Field | Value |
|-------|--------|
| Purpose | Reports dedup unique index (reports only) |
| Objects | `idx_reports_open_dedup` partial unique index |
| Additive | Yes (`IF NOT EXISTS`) |
| Rollback difficulty | Low — `DROP INDEX` |
| Preflight | Duplicate OPEN reports will fail index create — run preflight query in file header |
| Validation | §D.3 |
| Failure means | Data conflict or index missing — **STOP** before 0004 |
| Stop condition | `ERROR: could not create unique index` |

### 0004 — `0004_onboarding_question_seed.sql`

| Field | Value |
|-------|--------|
| Purpose | Seed onboarding question FK target |
| Objects | One row `22222222-2222-2222-2222-222222222222` |
| Additive | Yes (`ON CONFLICT DO NOTHING`) |
| Rollback difficulty | Low — `DELETE` seed row (see §H) |
| Validation | §D.4 |
| Failure means | FK smoke will fail — **STOP** |
| Stop condition | Seed count ≠ 1 |

### 0005 — `0005_answers_onboarding_hardening.sql`

| Field | Value |
|-------|--------|
| Purpose | Unique `(user_id, question_id)` + hardened insert RLS |
| Objects | `idx_answers_user_question_unique`, replaces `answers_insert_own`, `depth_evaluations_insert_own` |
| Additive | Yes (replaces two policies by name) |
| Rollback difficulty | Medium — restore 0002 insert policies + drop index (§H) |
| Preflight | Duplicate `(user_id, question_id)` rows will fail — query in file header |
| Validation | §D.5 |
| Failure means | Cross-user insert guard or dedup not active — **STOP**, mark **BLOCKED** |
| Stop condition | Index or policy missing |

---

## D. Schema validation queries (SQL editor OK — no `auth.uid()` required)

Run as **read-only** check. Service role sees all rows; use only for **schema**, not RLS behavior.

### D.1 — Tables exist (after 0001)

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'questions', 'answers', 'depth_evaluations',
    'reports', 'blocks', 'profile_private'
  )
ORDER BY 1;
```

**Expected:** 7 rows. **Fail:** missing table → **STOP**.

### D.2 — RLS enabled (after 0002)

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles', 'answers', 'depth_evaluations', 'questions')
ORDER BY 1;
```

**Expected:** all `rls_enabled = true`. **Fail:** any `false` → **STOP**.

### D.3 — Reports dedup index (after 0003)

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_reports_open_dedup';
```

**Expected:** 1 row. **Fail:** missing → **STOP** (reports path; note for alpha).

### D.4 — Seed question (after 0004)

```sql
SELECT id, active
FROM public.questions
WHERE id = '22222222-2222-2222-2222-222222222222';
```

**Expected:** exactly 1 row, `active = true`. **Fail:** 0 or >1 → **STOP**.

```sql
SELECT COUNT(*) AS seed_count
FROM public.questions
WHERE id = '22222222-2222-2222-2222-222222222222';
```

**Expected:** `seed_count = 1`.

### D.5 — Hardening index + policies (after 0005)

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_answers_user_question_unique';
```

**Expected:** 1 row.

```sql
SELECT polname, polcmd
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('answers', 'depth_evaluations')
ORDER BY c.relname, polname;
```

**Expected:** includes `answers_insert_own`, `answers_select_own`, `depth_evaluations_insert_own`, `depth_evaluations_select_own`.

### D.6 — Foreign keys (after 0001)

```sql
SELECT conname, conrelid::regclass AS from_table, confrelid::regclass AS to_table
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace
  AND conrelid::regclass::text IN ('public.answers', 'public.depth_evaluations')
ORDER BY 1;
```

**Expected:** `answers.user_id` → `profiles`, `answers.question_id` → `questions`, `depth_evaluations.answer_id` → `answers`.

### D.7 — Service role not required for user paths (design check)

**Expected:** App uses publishable key + user JWT only (`lib/supabase/server.ts`).  
**Fail:** If smoke requires `SUPABASE_SERVICE_ROLE_KEY` in app env → **BLOCKED**.

---

## E. Authentication method for RLS smoke (read before §F)

### SQL editor limitation — do NOT pretend

| Context | `auth.uid()` | RLS enforced? |
|---------|--------------|---------------|
| Supabase SQL editor as `postgres` / service role | **Bypasses RLS** | **No** |
| SQL editor with `SET request.jwt.claim.sub` hacks | **Unreliable / UNPROVEN** | Do not rely |
| PostgREST / `supabase-js` with user **access_token** | **Yes** | **Yes** |
| App routes on `unstandard-m9qj` with session cookie | **Yes** (server) | **Yes** |

**Rule:** Adversarial RLS tests (§F) **MUST** use **User A / User B authenticated clients**, not naked SQL editor writes.

### Obtaining user JWT locally (never commit)

1. Login User A via magic link on **Vercel Preview** `/login` (adapter **still disabled**).
2. Browser DevTools → Network → filter `token` or inspect Supabase auth cookie/session.
3. Copy `access_token` to **local terminal env only**: `export USER_A_TOKEN='...'`
4. **Never** paste into GitHub, PR comments, or this repo.
5. Repeat for User B in separate browser profile/incognito.
6. Record evidence as: `User A token obtained locally (redacted), expiry noted`.

**Alternative:** Supabase Dashboard → Authentication → Users → send magic link to disposable emails; use REST with token from client session.

### PostgREST curl template (replace placeholders locally)

```bash
# Staging project URL and publishable key from Vercel env (local only — do not commit)
export SUPABASE_URL='https://<staging-ref>.supabase.co'
export SUPABASE_PUBLISHABLE_KEY='<publishable-key>'
export USER_A_ID='<uuid-a>'
export USER_B_ID='<uuid-b>'
export USER_A_TOKEN='<redacted-local-only>'
export USER_B_TOKEN='<redacted-local-only>'
export QUESTION_ID='22222222-2222-2222-2222-222222222222'
```

```bash
# Example: User A insert own profile (allowed)
curl -sS -o /tmp/rls-out.json -w "HTTP %{http_code}\n" \
  -X POST "$SUPABASE_URL/rest/v1/profiles" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"id\":\"$USER_A_ID\",\"nickname\":\"smoke-a\"}"
```

PostgREST returns `201` on success, `401`/`403` on RLS denial (often empty body or JWT error).

---

## F. User A / User B adversarial test matrix

**Actor:** User A = `$USER_A_TOKEN`, User B = `$USER_B_TOKEN`.  
**On failure of security cases (F4–F8):** verdict **BLOCKED**, stop smoke, §H rollback consideration.

| ID | Test | Setup | Command / action | Actor | Pass | Fail | Evidence | Stop if fail |
|----|------|-------|------------------|-------|------|------|----------|--------------|
| F1 | User A insert own profile | A logged in | POST `/rest/v1/profiles` `id=USER_A_ID`, `nickname` | A | HTTP 201 or 409 if exists | 401/403 | status code | No — retry setup |
| F2 | User A update own profile nickname | F1 done | PATCH `/rest/v1/profiles?id=eq.USER_A_ID` | A | HTTP 204 | 403 | status | No |
| F3 | User A insert own onboarding answer | F1, seed 0004 | POST `/rest/v1/answers` `user_id=A`, `target_profile_id=A`, `question_id=QUESTION_ID`, `answer_text` (20+ chars) | A | HTTP 201 | 403 | status, redacted id | **STOP** if 403 |
| F4 | User A cannot target User B profile | F1, know B id | POST `/rest/v1/answers` `user_id=A`, `target_profile_id=B`, same question | A | **403/401** (denied) | **201** | status | **BLOCKED** |
| F5 | User A cannot SELECT B answers | F3 created A answer | GET `/rest/v1/answers?user_id=eq.USER_B_ID` | A | `[]` or 403 | B's rows visible | row count 0 | **BLOCKED** |
| F6 | User B cannot SELECT A answers | F3 | GET `/rest/v1/answers?user_id=eq.USER_A_ID` | B | `[]` or 403 | A's `answer_text` visible | row count 0 | **BLOCKED** |
| F7 | User B cannot insert eval for A answer | F3, capture `ANSWER_A_ID` | POST `/rest/v1/depth_evaluations` `answer_id=ANSWER_A_ID`, `user_id=B`, verdict PASS | B | **403/401** | **201** | status | **BLOCKED** |
| F8 | Duplicate answer rejected | F3 done | Repeat F3 identical `user_id`+`question_id` | A | **409** unique violation | second 201 row | status + count | **BLOCKED** if duplicate row |
| F9 | Anon cannot insert profile | No Authorization header | POST `/rest/v1/profiles` with apikey only | anon | 401/403 | 201 | status | **BLOCKED** |
| F10 | Logged-out app route blocked | Adapter disabled OK | `curl -X POST https://<preview-host>/api/onboarding/answer` no cookies, valid JSON body | none | **401** or **403** | 201 | status | **BLOCKED** if 201 |
| F11 | Session API safe fields | Login A on Preview host | `curl -b cookies.txt https://<preview-host>/api/auth/session` | A | keys: nickname, onboarded, idPrefix only | email/token/id present | redacted JSON | **BLOCKED** |

### F8 validation query (service role / SQL editor read-only OK)

```sql
SELECT user_id, question_id, COUNT(*) AS n
FROM public.answers
WHERE question_id = '22222222-2222-2222-2222-222222222222'
GROUP BY 1, 2
HAVING COUNT(*) > 1;
```

**Expected:** 0 rows.

### F7 follow-up — User A can insert own evaluation (sanity)

| Setup | Action | Actor | Pass |
|-------|--------|-------|------|
| F3 answer exists | POST `depth_evaluations` with `user_id=A`, `answer_id=ANSWER_A_ID` | A | 201 |

---

## G. App-level smoke (plan only — do NOT execute in this phase)

Execute **only after** §F verdict = **PASS**.

| Step | Action | Gate |
|------|--------|------|
| G1 | Founder approval to set `ANSWERS_PERSISTENCE_ADAPTER=supabase-alpha` on **Vercel Preview only** (staging Supabase) | Written approval |
| G2 | Redeploy **Preview** for PR #30 branch | Record Preview deployment SHA |
| G3 | Login User A → `GET /api/auth/session` → `onboarded: false` | |
| G4 | Submit onboarding → `POST /api/onboarding/answer` or UI → **201** | |
| G5 | Verify `profiles.onboarded_at` set **only after** answer + depth_evaluation exist (SQL read-only) | |
| G6 | `GET /api/auth/session` → `onboarded: true` | |
| G7 | Re-submit → **200** duplicate | |
| G8 | Logout → `/app/settings` → **307** → `/login` | P0-5 regression |
| G9 | Disable adapter / rollback if any fail | §H |

Full cases: [`ANSWERS_PERSISTENCE_SMOKE.md`](./ANSWERS_PERSISTENCE_SMOKE.md).

---

## H. Rollback / recovery plan

### Safe rollback layers

| Layer | Action | Approval |
|-------|--------|----------|
| App | Keep `ANSWERS_PERSISTENCE_ADAPTER` **disabled** or remove | Founder |
| Vercel | No adapter enable = app stays off DB path | — |
| Data | Delete smoke test rows only (staging) | Founder |

### Delete smoke test data (staging SQL — destructive, staging only)

```sql
-- Replace UUIDs locally before run
DELETE FROM public.depth_evaluations WHERE user_id IN ('<USER_A_ID>', '<USER_B_ID>');
DELETE FROM public.answers WHERE user_id IN ('<USER_A_ID>', '<USER_B_ID>');
DELETE FROM public.profiles WHERE id IN ('<USER_A_ID>', '<USER_B_ID>');
-- Seed row: keep unless full 0004 rollback intended
```

### Reverse 0005 (if needed before production)

```sql
DROP INDEX IF EXISTS public.idx_answers_user_question_unique;

DROP POLICY IF EXISTS answers_insert_own ON public.answers;
CREATE POLICY answers_insert_own ON public.answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS depth_evaluations_insert_own ON public.depth_evaluations;
CREATE POLICY depth_evaluations_insert_own ON public.depth_evaluations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Full schema rollback (staging nuclear — founder only)

Drop tables in reverse FK order or restore Supabase branch backup if available.

### When to ABORT and restore

- Wrong Supabase project (production)
- Token pasted into GitHub
- RLS test F4–F9 any **BLOCKED** result
- Migration applied out of order

---

## I. Evidence template (copy per step)

| Field | Value |
|-------|--------|
| Timestamp (UTC) | |
| Supabase project | `staging-***` (redacted ref) |
| PR #30 SHA | `0dae7c9` |
| Base main SHA | `12ccb773` |
| Vercel target | Preview deployment host (app tests only) |
| Migration step | 0001–0005 / F1–F11 / G* |
| Actor | User A / User B / anon / SQL-readonly |
| Command | curl/SQL (**no tokens**) |
| Expected | |
| Observed | |
| Pass/Fail | |
| Screenshot/log ref | redacted link or local path |

---

## J. Pass/fail gate (final verdict)

| Verdict | Meaning | Next step |
|---------|---------|-----------|
| **PASS** | 0001–0005 applied + §D validated + §F all security cases pass | Consider §G app adapter smoke (founder approval) |
| **NEEDS FIX** | Schema/policy/index issue fixable in SQL/migration | Fix PR #30 migration docs/SQL, re-run |
| **BLOCKED** | Cross-user read/write succeeded when it must not | **Do not enable adapter.** §H rollback review |
| **ABORT** | Wrong project, production risk, token leak | Stop immediately, founder incident review |

**This runbook PASS does not mean:**
- PR #30 merge approval
- Alpha readiness
- Reports/blocks/unlock complete

---

## Sequence summary

```
Preconditions (§B)
  → Apply 0001 → validate D.1
  → Apply 0002 → validate D.2
  → Apply 0003 → validate D.3
  → Apply 0004 → validate D.4
  → Apply 0005 → validate D.5–D.6
  → Adversarial RLS F1–F11 (authenticated JWT, NOT SQL editor writes)
  → Verdict (§J)
  → [Later, founder approval] App smoke §G with adapter on Vercel Preview + staging Supabase only
```
