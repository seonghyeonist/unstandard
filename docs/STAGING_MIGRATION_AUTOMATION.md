# Staging Migration Automation — Supabase CLI Workflow

> **Target:** Unstandard-staging database only.  
> **Production:** untouchable.  
> **Adapter:** do not enable until RLS smoke PASS.  
> **Service role:** never use or request for migration or smoke.  
> **Mode:** dry-run first, human apply second. No automatic `db push`.

This document replaces the SQL Editor copy-paste method for staging migration execution with a founder-run, reproducible Supabase CLI workflow. SQL Editor remains a fallback for emergency repair only, not the default.

## Canonical target

| Field | Value |
|-------|-------|
| Vercel project | `unstandard-m9qj` (host: `https://unstandard-m9qj.vercel.app`) |
| Supabase target | **Unstandard-staging only** |
| Production | **DO NOT TOUCH** |

If the target project is not confirmed as Unstandard-staging, stop immediately.

---

## Why this is safer than SQL Editor copy-paste

- **Migration history is tracked.** `supabase db push` records applied migrations in the remote `supabase_migrations.schema_migrations` table, so the same migration is not accidentally reapplied.
- **Dry-run shows the exact diff before any write.** Founder can inspect the SQL that would run before confirming.
- **No service role in the browser.** CLI uses the founder's authenticated Supabase session; the workflow never asks for `SUPABASE_SERVICE_ROLE_KEY`.
- **Reproducible across machines.** Any teammate with the same CLI version and linked project gets the same result.
- **Source-controlled SQL.** Migration files in `supabase/migrations/` are reviewed in PRs before they reach staging.

---

## Prerequisites

- Node.js / npm installed (repo uses Node 20.x/22.x).
- `npm install` run in repo root (`supabase` is listed in `devDependencies`).
- Founder has Supabase dashboard access to the staging project.
- A clean git working tree and a calm window for review.

---

## Setup (one-time per machine)

```bash
# 1. Install Supabase CLI into the project (already in devDependencies)
npm install

# 2. Log in to Supabase (opens browser)
npx supabase login

# 3. Initialize local Supabase config if this is the first time on the machine
#    (skip if supabase/config.toml already exists)
npx supabase init

# 4. Link to the staging project only
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

Replace `<STAGING_PROJECT_REF>` with the Unstandard-staging project reference (e.g. `xxxxxxxxxxxxxxxxxxxx`). Confirm it is the staging project before linking.

---

## Dry-run (always run this first)

```bash
npm run db:staging:dry-run
```

Which runs:

```bash
supabase db push --linked --dry-run
```

### Expected dry-run output

```text
Connecting to remote database...
No differences found.
```

or, when there are new migrations to apply:

```text
Connecting to remote database...
Applying migration 0003_reports_dedup_index.sql...
Would apply migration 0003_reports_dedup_index.sql.
```

The command prints the SQL that would run but does **not** execute it.

### Stop conditions — dry-run output

Stop and do **not** proceed to `db:staging:push` if any of the following appear:

- Output references a production project or host.
- Migration list includes migrations not in `supabase/migrations/`.
- SQL includes `DROP TABLE`, `DROP SCHEMA`, `DELETE`, `UPDATE`, or anything outside the PR scope.
- Any migration error or connection failure.
- You are unsure about the target project.

If dry-run shows unexpected diffs, verify the local `supabase/migrations/` files match the PR and that the remote is linked to staging.

---

## Apply (human-confirmed only)

```bash
npm run db:staging:push
```

Which runs:

```bash
supabase db push --linked
```

Run this only after:

1. `npm run db:staging:dry-run` output is reviewed and expected.
2. Target is confirmed as Unstandard-staging.
3. Founder is healthy enough to review output.
4. No one else is applying migrations to staging concurrently.

Do not run this automatically in CI, cron, or GitHub Actions without explicit approval.

---

## Post-apply verification SQL

Run these in the Supabase SQL Editor **after** `db:staging:push` succeeds, or connect via `supabase db query` / `psql` if supported. These are read-only checks.

```sql
-- 1. Verify all expected tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'profile_private', 'questions', 'answers',
    'depth_evaluations', 'reports', 'blocks', 'app_config',
    'events', 'unlocks', 'conversations', 'conversation_members', 'messages'
  )
ORDER BY table_name;

-- 2. Verify RLS is enabled on private tables
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN (
    'profiles', 'profile_private', 'questions', 'answers',
    'depth_evaluations', 'reports', 'blocks', 'app_config',
    'events', 'unlocks', 'conversations', 'conversation_members', 'messages'
  )
  AND relkind = 'r'
ORDER BY relname;

-- 3. Verify the reports deduplication index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_reports_open_dedup';

-- 4. Verify no duplicate OPEN reports would violate the new index
SELECT reporter_user_id, target_type, target_id, COUNT(*) AS n
FROM public.reports
WHERE status = 'OPEN'
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;

-- 5. Verify migration history was recorded
SELECT version, name, executed_at
FROM supabase_migrations.schema_migrations
ORDER BY executed_at DESC
LIMIT 10;
```

Expected results:

- All tables from the migration list are present.
- `rls_enabled` is `true` for every table above.
- `idx_reports_open_dedup` exists.
- Duplicate OPEN reports query returns **zero rows**.
- `supabase_migrations.schema_migrations` contains the latest migration version with a recent `executed_at` timestamp.

If any check fails, do not enable the adapter. Investigate and repair the schema first.

---

## RLS smoke command

After migration and verification SQL pass, run the adversarial RLS smoke test:

```bash
npm run smoke:rls
```

Which runs:

```bash
tsx scripts/smoke/rls-adversarial.ts
```

### Required environment variables for the real smoke test

```bash
STAGING_SUPABASE_URL=https://<STAGING_PROJECT_REF>.supabase.co
STAGING_SUPABASE_ANON_KEY=<staging-publishable-anon-key>
USER_A_JWT=<jwt-for-test-user-a>
USER_B_JWT=<jwt-for-test-user-b>
TEST_QUESTION_ID=22222222-2222-2222-2222-222222222222  # optional, default provided
```

**Important:** The current file is a placeholder. The full implementation lives in PR #35 (`cursor/rls-adversarial-smoke-2aa9`). Do not merge PR #35 until after `db:staging:dry-run` and `db:staging:push` succeed on staging. After merging, the same script path runs the full adversarial checks.

This smoke test uses the **publishable anon key and user JWTs only**. It does **not** use `SUPABASE_SERVICE_ROLE_KEY`.

---

## Rollback / stop rules

1. **Before any command:** confirm the target is Unstandard-staging. If not, stop.
2. **Before push:** dry-run must pass and be reviewed. If dry-run is unexpected, stop.
3. **During push:** if any error occurs, stop. Do not retry blindly. Check the error and the remote schema state.
4. **After push:** run verification SQL. If any check fails, do not enable the adapter. Consider migration repair only after verifying actual schema state.
5. **If manual SQL Editor changes were applied before this workflow:** warn about migration history mismatch. The remote may already contain changes that bypass `supabase_migrations.schema_migrations`. In that case, run `supabase migration repair` **only after** verifying the actual schema state with the verification SQL above.
6. **If founder is not healthy enough to review output:** stop after dry-run.

---

## Warnings

### Manual SQL Editor application

Applying migrations manually through the Supabase SQL Editor bypasses migration history. This causes `supabase db push` to report that migrations are out of sync even when the schema is already correct. If migrations were already manually applied to remote, verify the actual schema with the post-apply SQL above, then use `supabase migration repair` to reconcile history only if you are certain the schema matches.

### Service role

Do not use `SUPABASE_SERVICE_ROLE_KEY` for migration execution, smoke tests, or verification. Service role bypasses RLS and is intended for server-side backend operations only. If a command asks for a service role key, stop and reassess.

### Adapter enablement

Do not enable any persistence adapter (e.g., `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha`) until:

1. `db:staging:push` succeeds on Unstandard-staging.
2. Post-apply verification SQL passes.
3. `npm run smoke:rls` passes (after merging the PR #35 implementation).

Enabling the adapter before RLS is verified can expose data to unauthorized access.

---

## Commands summary

| Step | Command | Notes |
|------|---------|-------|
| Login | `npx supabase login` | One-time per machine. |
| Link | `npx supabase link --project-ref <STAGING_PROJECT_REF>` | Staging only. |
| Dry-run | `npm run db:staging:dry-run` | Always run first. Stop if unexpected. |
| Apply | `npm run db:staging:push` | Human-confirmed only. |
| Verify | Run post-apply SQL in SQL Editor. | Read-only checks. |
| RLS smoke | `npm run smoke:rls` | After PR #35 implementation is merged. |

---

## Final recommendation

Today, stop after `npm run db:staging:dry-run` unless the founder explicitly confirms:

- They are healthy enough to review the dry-run output.
- The target is confirmed as Unstandard-staging.
- The dry-run output is exactly what is expected for the current PR.

If any of those are not true, do not proceed to `npm run db:staging:push`.
