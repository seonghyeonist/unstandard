# Staging Migration Automation — Supabase CLI Workflow

> **Target:** Unstandard-staging only.  
> **Production:** Untouchable.  
> **Adapter:** Do not enable until RLS smoke passes.  
> **Service role:** Not used, not requested.

This document replaces manual SQL Editor copy-paste with a founder-run, dry-run-first Supabase CLI workflow for applying migrations to the staging project.

---

## 1. Scope and hard rules

| Rule | Value |
|------|-------|
| Target project | Unstandard-staging only |
| Production | Untouchable |
| Adapter (`ANSWERS_PERSISTENCE_ADAPTER`) | Disabled until RLS adversarial smoke passes |
| Service role (`SUPABASE_SERVICE_ROLE_KEY`) | Do not use or request |
| Migration SQL | Do not edit |
| Automatic push | Not allowed; push is a founder decision |
| GitHub Actions workflow | Not created unless explicitly approved |
| Default execution | `dry-run` first, then stop |

---

## 2. Why this is safer than SQL Editor copy-paste

| Risk with SQL Editor | Supabase CLI mitigation |
|----------------------|-------------------------|
| No diff preview; paste the wrong file or skip a migration | `db push --dry-run` shows the exact SQL before execution |
| Manual history can diverge from the repo; hard to roll back | CLI records migrations in Supabase `supabase_migrations.schema_migrations` table |
| Accidentally runs against Production | Requires explicit `npx supabase link --project-ref <STAGING_PROJECT_REF>`; no global default |
| Service role or Dashboard privileges bypass RLS | Uses founder’s own Supabase CLI login with the linked project’s normal role |
| No standard verification step | Post-apply verification SQL + RLS adversarial smoke are mandatory gates |

---

## 3. Prerequisites

```bash
npm ci
```

Ensure `supabase` CLI is installed as a dev dependency (committed by this workflow):

```bash
npm ls supabase --depth=0
```

---

## 4. One-time setup (founder machine only)

Run on the local machine that will perform the push. Do not paste secrets into this repo.

```bash
# 1. Authenticate the Supabase CLI with your personal account
npx supabase login

# 2. Link the working directory to the Unstandard-staging project only
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

`<STAGING_PROJECT_REF>` is the short identifier in the staging Supabase project URL: `https://<STAGING_PROJECT_REF>.supabase.co`.

After linking, verify the linked project:

```bash
npx supabase status
```

---

## 5. Dry-run (default step — stop here)

```bash
npm run db:staging:dry-run
```

Equivalent to:

```bash
npx supabase db push --linked --dry-run
```

### Expected dry-run output (shape)

```text
Connecting to remote database...
Do you want to push these migrations to the remote database?
   [D] 20240627000000_initial_schema
   [D] 20240627000001_rls_policies
   ...

-- Dry run --
-- Migration: ...
CREATE TABLE IF NOT EXISTS ...
...

Dry run complete. No changes applied.
```

If the output shows the expected migrations `0001` through `0005` for PR #30 and matches the files in `supabase/migrations/`, the dry-run is healthy.

### Stop conditions — do NOT proceed to push if any of these are true

- The target project is not Unstandard-staging.
- The dry-run shows `0004` or `0005` as already applied while the PR branch still contains unmerged changes — this indicates a history mismatch.
- The dry-run includes unexpected migrations not in `supabase/migrations/`.
- The dry-run SQL does not match the migration files reviewed in the PR.
- Any error, warning, or connection failure appears in the output.
- The founder is not healthy enough to make a deliberate push decision.

---

## 6. Apply migrations (explicit founder decision only)

Only after a successful dry-run and explicit confirmation:

```bash
npm run db:staging:push
```

Equivalent to:

```bash
npx supabase db push --linked
```

This command applies the migration files in `supabase/migrations/` to the linked Unstandard-staging project.

---

## 7. Post-apply verification SQL

Run these in the Supabase SQL Editor **after** push succeeds, or run them through the linked CLI with `npx supabase db query` (CLI v2.79.0+).

Do not use service role for these queries; use the same CLI login context.

### 7.1 Verify migrations are recorded

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

Expected: each file in `supabase/migrations/` appears as a row.

### 7.2 Verify tables exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'app_config',
    'answer_embeddings',
    'depth_evaluations',
    'profiles',
    'answers'
  )
ORDER BY table_name;
```

Expected: `profiles` and `answers` appear after PR #30 migrations are applied.

### 7.3 Verify RLS is enabled on user-facing tables

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'answers', 'depth_evaluations')
ORDER BY tablename;
```

Expected: `rowsecurity = true` for all listed tables.

### 7.4 Verify no public RLS bypass

```sql
SELECT polname, polrelid::regclass AS table, polpermissive
FROM pg_policy
WHERE polrelid::regclass::text IN ('profiles', 'answers', 'depth_evaluations')
ORDER BY polrelid::regclass::text, polname;
```

Expected: policies exist and are restrictive (`polpermissive = false`) where intended by the migration.

---

## 8. RLS adversarial smoke

Only run after migrations are applied and the verification SQL above looks correct.

### Required environment

```bash
export STAGING_SUPABASE_URL='https://<STAGING_PROJECT_REF>.supabase.co'
export STAGING_SUPABASE_ANON_KEY='<staging-anon-key>'
export USER_A_JWT='<user-a-access-token>'
export USER_B_JWT='<user-b-access-token>'
# optional
export TEST_QUESTION_ID='22222222-2222-2222-2222-222222222222'
export STAGING_APP_URL='https://unstandard-m9qj.vercel.app'
```

### Command

```bash
npm run smoke:rls
```

Equivalent to:

```bash
npx tsx scripts/smoke/rls-adversarial.ts
```

### Smoke coverage

1. User A can insert/update own profile.
2. User A can insert own answer.
3. User B cannot read User A answers.
4. User B cannot update User A answer.
5. User B cannot insert depth evaluations for User A answer.
6. Anonymous profile/answer inserts are blocked.
7. Duplicate `(user_id, question_id)` answer is rejected with `23505`.
8. Unauthenticated `/api/auth/session` returns `401` and exposes only safe fields.
9. Unauthenticated `/app/home` redirects to `/login`.

### Exit code

- `0` = all tests PASS.
- Non-zero = at least one FAIL; stop and investigate before enabling the adapter.

### Do not enable adapter until smoke passes

```bash
# DO NOT RUN THIS UNTIL RLS SMOKE PASSES
ANSWERS_PERSISTENCE_ADAPTER=supabase-alpha
```

---

## 9. Rollback and stop rules

### If dry-run is unhealthy

1. Stop immediately.
2. Do not run `db:staging:push`.
3. Investigate the linked project and migration history.
4. If migrations were manually applied through SQL Editor earlier, see section 10.

### If push fails mid-way

1. Do not run the push again blindly.
2. Check the error message and the remote schema state.
3. Consider `npx supabase migration repair` **only after** verifying the actual schema state against the migration files.
4. Consult [`docs/GIT_RECOVERY_LOG.md`](./GIT_RECOVERY_LOG.md) for code rollback if needed.

### If RLS smoke fails

1. Stop. Do not enable `ANSWERS_PERSISTENCE_ADAPTER`.
2. Fix the migration or RLS policy in a new branch and PR.
3. Re-run `db:staging:dry-run` and `db:staging:push` after the fix is approved.

### Code rollback (if PR is merged and causes regression)

```bash
git revert <merge-sha>
```

Keep `ANSWERS_PERSISTENCE_ADAPTER` disabled on Vercel until the regression is fixed.

---

## 10. Warning: manual SQL Editor changes bypass migration history

If migrations `0001` through `0005` were already applied manually via SQL Editor, `supabase db push` may report that some migrations are already applied or may fail with a history mismatch.

### Recommended recovery

1. Do not guess. Verify the actual schema state first with the verification SQL in section 7.
2. Compare the live schema against the migration files in `supabase/migrations/`.
3. If the live schema matches the migration files exactly, use `npx supabase migration repair` to mark the migrations as applied in the CLI history.
4. If the live schema does not match, do not repair. Fix the schema manually or create a new migration, then re-run dry-run.
5. Never repair without verifying the actual schema state first.

---

## 11. Security reminders

- Do not request or store `SUPABASE_SERVICE_ROLE_KEY` for this workflow.
- Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel Preview or Production for migration purposes.
- Do not enable `ANSWERS_PERSISTENCE_ADAPTER` until the RLS adversarial smoke passes.
- The smoke script uses only the publishable/anon key and two user JWTs. No service role.

---

## 12. Summary of commands

```bash
# 1. Setup (one time)
npx supabase login
npx supabase link --project-ref <STAGING_PROJECT_REF>

# 2. Dry-run (default; stop after this)
npm run db:staging:dry-run

# 3. Push (explicit founder decision only)
npm run db:staging:push

# 4. Verify schema and RLS (SQL Editor or npx supabase db query)
#    See section 7.

# 5. RLS smoke (only after migrations applied)
export STAGING_SUPABASE_URL='...'
export STAGING_SUPABASE_ANON_KEY='...'
export USER_A_JWT='...'
export USER_B_JWT='...'
npm run smoke:rls
```

---

## 13. Final recommendation

**Today, stop after `npm run db:staging:dry-run` unless the founder explicitly confirms:**

1. They are healthy enough to make a deliberate push decision.
2. The linked target is Unstandard-staging.
3. The dry-run output matches the expected migrations exactly.

Dry-run is safe, read-only, and reversible. Push is the only destructive step and must be a founder decision.
