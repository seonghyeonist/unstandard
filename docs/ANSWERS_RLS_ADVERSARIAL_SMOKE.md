# Answers RLS Adversarial Smoke — Execution Runbook (PR #30 + PR #52)

> **Task:** Staging-only direct migration + RLS adversarial smoke for PR #30 onboarding answers.
> **Alpha verdict:** **BLOCKED** — this runbook does not change that.
> **Pin note:** SHA pins are for evidence/rollback/smoke traceability only. They are not merge approval.

### SHA traceability (do not collapse these)

| Role | SHA | Notes |
|------|-----|--------|
| Base `main` (merge target) | `12ccb77395858a3778ace4d61693bc4b29f8c503` | Do not commit to `main` |
| **Code/migration execution snapshot (through 0005)** | `f795038533ea4cfe55bd71fdb59de68eb97e69fc` | Last PR #30 change under `app` / `lib` / `supabase/migrations` before docs-only commits — **not** interchangeable with PR #30 head |
| **Current PR #30 head** | `945b739c00a2cb2043cf8da46d919b7c480dcde3` | May include docs-only drift after the execution snapshot — **not** a substitute for the execution snapshot |
| **PR #52 (superseding PR #35)** | verify at run time (`git rev-parse` on PR #52 / execution branch) | Smoke harness + migration `0006`; stacked on PR #30 |
| Historical (superseded) | PR #35 head `0f51c42…` | Historical only — do not execute from PR #35 |
| Execution checkout (db scripts + smoke) | temporary branch stacked on PR #52 | Adds `db:staging:dry-run` / `db:staging:push` from PR #51 tooling |

**Rule:** `git diff --name-only f795038 945b739c -- app lib supabase/migrations` was empty at recon (docs-only between those heads for runtime paths). If a later commit changes `app` / `lib` / `supabase/migrations`, **stop** and re-pin the execution snapshot before staging mutation.

**Branches:** PR #30 `cursor/db-backed-answers-8eec` · **PR #52** `cursor/rls-adversarial-smoke-fix-909d` (supersedes PR #35) · execution checkout stacked on PR #52 (adds `db:staging:*`).

**Changed files on PR #52 (vs PR #30):**
- `package.json` (`smoke:rls`)
- `scripts/smoke/rls-adversarial.ts`
- `supabase/migrations/0006_answers_update_target_invariant.sql`
- `docs/ANSWERS_RLS_ADVERSARIAL_SMOKE.md`
- `docs/ANSWERS_PERSISTENCE_SMOKE.md`

**Execution checkout additionally includes (from PR #51 tooling):**
- `package.json` (`db:staging:dry-run`, `db:staging:push`) + `supabase` devDependency / lockfile
- `docs/STAGING_MIGRATION_AUTOMATION.md`

Related:
- [`ANSWERS_PERSISTENCE_SMOKE.md`](./ANSWERS_PERSISTENCE_SMOKE.md) — app-level smoke (later phase)
- [`STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md) — P0-5 auth (passed on canonical target)
- [`ALPHA_READINESS_CHECKLIST.md`](./ALPHA_READINESS_CHECKLIST.md)

---

## A. Scope and non-scope

### In scope (staging only)

- Apply migrations `0001` → `0006` (PR #30 `0001`–`0005` + **PR #52** `0006` UPDATE invariant) to **staging Supabase** (human executes — only after explicit `RUN STAGING MIGRATIONS`).
- Validate schema, RLS enabled, policies, unique index, seed row.
- Adversarial RLS tests with **User A** and **User B** via **authenticated client** (not service role).
- Automated harness: `npm run smoke:rls` (`scripts/smoke/rls-adversarial.ts`).
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
| P3 | Code/migration execution snapshot = `f795038…` **and** confirm PR #30 head separately | ☐ | `git rev-parse` + `git diff --name-only f795038 <pr30-head> -- app lib supabase/migrations` |
| P4 | Local migration files include `0001`–`0006` (0006 required for UPDATE target invariant) | ☐ | `ls supabase/migrations/` |
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

### 0006 — `0006_answers_update_target_invariant.sql` (**required** — MERGE BLOCKER if skipped)

| Field | Value |
|-------|--------|
| Purpose | Harden `answers` UPDATE so `target_profile_id` cannot be retargeted to another user |
| Objects | Replaces `answers_update_own` WITH CHECK (`auth.uid() = user_id` **and** `auth.uid() = target_profile_id`) |
| Additive | Yes (replaces one policy by name) |
| Rollback difficulty | Low — restore 0002 update policy |
| Validation | §D.5b + harness case `4b-user-a-update-retarget-denied` |
| Failure means | INSERT hardening (0005) bypassable via UPDATE — **STOP**, mark **BLOCKED** |
| Stop condition | Policy missing or retarget UPDATE succeeds |

**Audit finding:** `0002` `answers_update_own` only checked `auth.uid() = user_id`. After 0005 INSERT hardening, an owner could still `UPDATE` `target_profile_id` to another profile. **0006 closes that hole.** Do not claim RLS PASS without 0006 applied and case `4b` green.

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

**Expected:** includes `answers_insert_own`, `answers_select_own`, `answers_update_own`, `depth_evaluations_insert_own`, `depth_evaluations_select_own`.

### D.5b — UPDATE target invariant (after 0006)

```sql
SELECT pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'answers'
  AND p.polname = 'answers_update_own';
```

**Expected:** expression includes `target_profile_id` bound to `auth.uid()` (not `user_id` alone). **Fail:** missing `target_profile_id` check → **STOP** (MERGE BLOCKER).

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
3. Copy `access_token` to **local terminal env only**: `export USER_A_JWT='...'`
4. **Never** paste into GitHub, PR comments, or this repo.
5. Repeat for User B in separate browser profile/incognito.
6. Record evidence as: `User A token obtained locally (redacted), expiry noted`.

**Alternative:** Supabase Dashboard → Authentication → Users → send magic link to disposable emails; use REST with token from client session.

### Environment variable map (reconcile runbook ↔ harness ↔ Vercel)

| Harness (`npm run smoke:rls`) | Curl samples (this doc) | Vercel Preview (app) | Notes |
|------------------------------|-------------------------|----------------------|-------|
| `STAGING_SUPABASE_URL` | `SUPABASE_URL` | `UNSTANDARD_SUPABASE_URL` | Staging project only — verify name **Unstandard-staging** manually |
| `STAGING_SUPABASE_ANON_KEY` | `SUPABASE_PUBLISHABLE_KEY` | `UNSTANDARD_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon — **never** service role |
| `USER_A_JWT` / `USER_B_JWT` | `USER_A_TOKEN` / `USER_B_TOKEN` | — | Access tokens; local only |
| `STAGING_APP_URL` | Preview origin in curl | `UNSTANDARD_APP_URL` | **Required** for harness app checks; **no default**; reject `unstandard-m9qj.vercel.app` |
| `USER_A_SESSION_COOKIE` | cookie jar | session cookie | Optional; without it case `8b` is MANUAL → harness exits **INCOMPLETE** (not PASSED) |
| `TEST_QUESTION_ID` | `QUESTION_ID` | — | Default seed `22222222-2222-2222-2222-222222222222` |

### PostgREST curl template (replace placeholders locally)

```bash
# Staging project URL and publishable key from Vercel env (local only — do not commit)
export STAGING_SUPABASE_URL='https://<staging-ref>.supabase.co'
export STAGING_SUPABASE_ANON_KEY='<publishable-key>'
export USER_A_ID='<uuid-a>'
export USER_B_ID='<uuid-b>'
export USER_A_JWT='<redacted-local-only>'
export USER_B_JWT='<redacted-local-only>'
export STAGING_APP_URL='https://<preview-deployment-host>'
export TEST_QUESTION_ID='22222222-2222-2222-2222-222222222222'
```

```bash
# Example: User A insert own profile (allowed)
curl -sS -o /tmp/rls-out.json -w "HTTP %{http_code}\n" \
  -X POST "$STAGING_SUPABASE_URL/rest/v1/profiles" \
  -H "apikey: $STAGING_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_A_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"id\":\"$USER_A_ID\",\"nickname\":\"smoke-a\"}"
```

PostgREST returns `201` on success, `401`/`403` on RLS denial (often empty body or JWT error).

### Automated harness

```bash
# Values local-only — do not print secrets
npm run smoke:rls
```

**Verdict semantics (harness):**
- RLS PASS only on PostgreSQL `42501` or explicit permission / row-level security denial text.
- `23503` (FK), `23505` (unique), validation, and unrelated DB errors **never** count as RLS PASS.
- Required SKIP / MANUAL / INCOMPLETE → exit non-zero; script must **not** print `PASSED`.
- Cross-target insert runs **before** own-answer insert so uniqueness cannot mask RLS.

---

## F. User A / User B adversarial test matrix

**Actor:** User A = `$USER_A_JWT`, User B = `$USER_B_JWT`.  
**On failure of security cases (F4–F9, F4b):** verdict **BLOCKED**, stop smoke, §H rollback consideration.

**RLS denial rule:** only `42501` / explicit permission or row-level security denial. `23503` / `23505` / other DB errors = **FAIL** for RLS cases (not PASS).

| ID | Test | Setup | Command / action | Actor | Pass | Fail | Evidence | Stop if fail |
|----|------|-------|------------------|-------|------|------|----------|--------------|
| F1 | User A insert/update own profile | A logged in | POST/PATCH `/rest/v1/profiles` | A | HTTP 201/204 or harness PASS | 401/403 unexpected | status code | No — retry setup |
| F1b | User B insert/update own profile | B logged in | same | B | same | same | status | No — needed so cross-target FK exists |
| F4 | User A cannot target User B profile | F1+F1b; **before** F3 | POST answers `user_id=A`, `target_profile_id=B` | A | **42501** or explicit RLS/permission denial **only** | **201** (bypass) — also **FAIL/UNVERIFIED** if only `23503` (FK) or `23505` (unique): those are **NOT RLS PASS** | status/code | **BLOCKED** |
| F3 | User A insert own onboarding answer | After F4 | POST answers `user_id=A`, `target_profile_id=A` | A | HTTP 201 | 403 | status, redacted id | **STOP** if 403 |
| F3b | User B insert own answer | After F1b | POST answers for B | B | HTTP 201 | 403 | status | No — needed for F5 |
| F5 | User A cannot SELECT B answers | F3b | GET answers `user_id=eq.USER_B_ID` | A | `[]` or 42501 | B's rows visible | row count 0 | **BLOCKED** |
| F6 | User B cannot SELECT A answers | F3 | GET answers `user_id=eq.USER_A_ID` | B | `[]` or 42501 | A's `answer_text` visible | row count 0 | **BLOCKED** |
| F7 | User B cannot UPDATE A answer | F3 | PATCH answers `id=ANSWER_A_ID` | B | 0 rows or 42501 | row updated | status | **BLOCKED** |
| F4b | User A cannot retarget own answer to B | F3 + 0006 | PATCH `target_profile_id=B` | A | 42501 / not persisted | **201/204 with retarget** | status | **BLOCKED** (MERGE BLOCKER without 0006) |
| F8 | User B cannot insert eval for A answer | F3 | POST depth_evaluations for A's answer | B | **42501** | **201** or FK-only | status | **BLOCKED** |
| F9 | Duplicate answer rejected | F3 done | Repeat F3 identical `user_id`+`question_id` | A | **23505** | second 201 row | status + count | **BLOCKED** if duplicate row |
| F10 | Anon cannot insert profile/answer (RLS, not FK) | Use **existing** User A ids so FK would pass | POST profiles + answers with apikey only | anon | **42501** | 201 or **23503-only** | status/code | **BLOCKED** |
| F11 | Logged-out app route blocked | Adapter disabled OK | `curl` Preview `/app/home` no cookies | none | **307/302** → `/login` | 200 | status | **BLOCKED** if 200 |
| F12 | Session API safe fields | Login A on Preview; `USER_A_SESSION_COOKIE` | `GET /api/auth/session` | A | keys: nickname, onboarded, idPrefix only | email/token/id present | redacted JSON | **BLOCKED**; MANUAL without cookie → harness **INCOMPLETE** |

### F9 validation query (service role / SQL editor read-only OK)

```sql
SELECT user_id, question_id, COUNT(*) AS n
FROM public.answers
WHERE question_id = '22222222-2222-2222-2222-222222222222'
GROUP BY 1, 2
HAVING COUNT(*) > 1;
```

**Expected:** 0 rows.

### F8 follow-up — User A can insert own evaluation (sanity)

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

### Reverse 0006 (if needed)

```sql
DROP POLICY IF EXISTS answers_update_own ON public.answers;
CREATE POLICY answers_update_own ON public.answers
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
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
| PR #30 execution snapshot | `f795038` |
| PR #30 head (docs may drift) | `945b739c` |
| Migrations applied | `0001`–`0006` |
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
| **PASS** | 0001–0006 applied + §D validated + §F all security cases pass (zero required SKIP/MANUAL) | Consider §G app adapter smoke (founder approval) |
| **NEEDS FIX** | Schema/policy/index/harness issue fixable | Fix migration/docs/harness, re-run |
| **BLOCKED** | Cross-user read/write succeeded when it must not; or UPDATE retarget succeeded without 0006 | **Do not enable adapter.** §H rollback review |
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
  → Apply 0005 → validate D.5
  → Apply 0006 → validate D.5b–D.6
  → Adversarial RLS F1–F12 (authenticated JWT, NOT SQL editor writes)
  → `npm run smoke:rls` with redacted local env (explicit STAGING_APP_URL)
  → Verdict (§J)
  → [Later, founder approval] App smoke §G with adapter on Vercel Preview + staging Supabase only
```
