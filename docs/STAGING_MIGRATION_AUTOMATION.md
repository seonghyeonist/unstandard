# Staging Migration Automation — Unstandard

> **Task:** Convert PR #30 staging migration execution from manual SQL Editor copy-paste into a safer founder-run Supabase CLI workflow.  
> **Target:** **Unstandard-staging only**  
> **Production:** Untouchable.  
> **Adapter:** Do not enable.  
> **Service role:** Do not use or request.  
> **Migration SQL:** Do not edit.  
> **Dry-run:** Always first.

This document describes the **local, manual, dry-run-first** workflow for applying PR #30 migrations to the Unstandard-staging Supabase project. It is a **process change**, not a product feature, and does not require a GitHub Actions workflow yet.

## What this replaces

The old fallback was: open Supabase Dashboard → SQL Editor → copy-paste `supabase/migrations/*.sql` → run. That is now **an emergency fallback only**, not the default.

Why CLI is safer:

- **Git-tracked migrations**: every change is reviewed in the PR before it reaches the database.
- **Automatic migration history**: `supabase db push` records applied migrations in `supabase_migrations.schema_migrations`.
- **Diff-based preview**: `--dry-run` shows exactly what SQL will run before it runs.
- **Founder-local authentication**: `npx supabase login` uses the founder's own browser/PAT. No agent handles secrets.
- **Reproducible**: any team member with access can run the same commands and see the same result.

## Canonical target lock

| Field | Value |
|-------|-------|
| Target project | **Unstandard-staging only** |
| Production project | **Never** |
| Vercel project for P0-5 smoke | `unstandard-m9qj` (canonical, do not substitute) |

If you are unsure which Supabase project is staging, **stop**. Confirm the project ref with the founder before linking.

## One-time local setup

Run once per machine, or whenever the staging project changes:

```bash
# 1. Install deps (supabase CLI is now a dev dependency)
npm install

# 2. Authenticate the Supabase CLI with your personal account
npx supabase login

# 3. Link this repo to the Unstandard-staging project only
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

- Replace `<STAGING_PROJECT_REF>` with the actual staging project reference (e.g. `abc123xyz789def`).
- Do **not** link to production.
- The link writes `supabase/.temp/project-ref` and `supabase/config.toml` (already in `.gitignore` or should be). Do **not** commit secrets or link tokens.

## PR #30 migrations

The migrations to apply are:

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_rls_policies.sql`
- `supabase/migrations/0003_reports_dedup_index.sql`

Do **not** edit these files. If they need changes, open a new PR.

## Step 1: dry-run

Always run dry-run first. Do not skip.

```bash
npm run db:staging:dry-run
```

Equivalent to:

```bash
supabase db push --linked --dry-run
```

### Expected dry-run output

```text
Connecting to remote database...
Connected to remote database.
Finished supabase db push --linked --dry-run.

The following migration statements are pending:

  0001_initial_schema.sql
  0002_rls_policies.sql
  0003_reports_dedup_index.sql



Verify these statements, then run `npm run db:staging:push` to apply.
```

The exact output depends on CLI version and migration state. The important part is: it lists the pending migrations and **does not write anything**.

## Step 2: apply (only after dry-run looks correct)

```bash
npm run db:staging:push
```

Equivalent to:

```bash
supabase db push --linked
```

This requires an interactive confirmation unless `--include-all` or `--include-roles` is added. Do **not** add auto-confirm flags. The founder must read the prompt and confirm manually.

## Step 3: post-apply verification SQL

After `db:staging:push` succeeds, run the following in the Supabase SQL Editor **or** via `supabase db query` (read-only queries) to verify the schema state matches the migration files.

```sql
-- 1. Tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'questions', 'answers', 'depth_evaluations',
    'reports', 'blocks', 'app_config', 'events', 'unlocks'
  )
ORDER BY table_name;

-- 2. RLS is enabled on private tables
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN (
  'profiles', 'answers', 'depth_evaluations', 'reports',
  'blocks', 'app_config', 'events', 'unlocks'
)
AND relkind = 'r';

-- 3. Reports deduplication index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_reports_unique_open_target';

-- 4. Migration history is clean
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

All expected objects should be present. If any are missing, **stop** and investigate before enabling anything.

## Step 4: RLS adversarial smoke

After migrations are verified, run the RLS adversarial smoke test. Do not enable any persistence adapter before this passes.

```bash
npm run smoke:rls
```

This executes `scripts/smoke/rls-adversarial.ts`.

> **Status:** `scripts/smoke/rls-adversarial.ts` is currently under development in PR #35 (`cursor/rls-adversarial-smoke-2aa9 @ 0f51c42`). It is **not merged** yet. The script command is reserved for when PR #35 lands. Until then, the RLS smoke is manual or blocked.

## Stop conditions (do not proceed)

Stop immediately if any of the following are true:

1. The target project is not confirmed to be **Unstandard-staging**.
2. `npm run db:staging:dry-run` shows migrations you did not expect.
3. `npm run db:staging:dry-run` shows **no pending migrations** but the dashboard SQL Editor was previously used to apply changes manually.
4. The founder is not healthy enough to review and confirm the dry-run output.
5. `SUPABASE_SERVICE_ROLE_KEY` is being requested or used.
6. Any adapter is being enabled before RLS smoke passes.
7. The migrations include any SQL that was not reviewed in PR #30.

## Manual SQL Editor fallback (emergency only)

If the CLI workflow is impossible (e.g. CLI auth failure, link failure), the SQL Editor can be used as a **temporary fallback** with these rules:

1. Apply the exact SQL from `supabase/migrations/*.sql` in order.
2. After applying, warn that migration history is now **mismatched**.
3. Run `supabase migration repair` only after verifying the actual schema state with the post-apply SQL above.
4. Do **not** enable the adapter until the mismatch is repaired and RLS smoke passes.

## Warning: manual SQL Editor changes bypass migration history

If migrations were already applied manually through the Supabase SQL Editor, the local migration files and the remote `supabase_migrations.schema_migrations` table may be out of sync. Symptoms include:

- `npm run db:staging:dry-run` shows no pending migrations even though you expect some.
- `supabase db push` tries to re-run statements that already exist, causing errors.
- `supabase migration list` shows gaps or duplicates.

### Recommended repair path

1. Run the post-apply verification SQL above to confirm which objects actually exist.
2. Compare the actual schema against `supabase/migrations/*.sql`.
3. If the schema matches the migrations but the history table is missing entries, run:

   ```bash
   npx supabase migration repair --status applied 0001_initial_schema.sql
   npx supabase migration repair --status applied 0002_rls_policies.sql
   npx supabase migration repair --status applied 0003_reports_dedup_index.sql
   ```

4. If the schema does **not** match, do **not** repair. Investigate the discrepancy first.
5. Re-run `npm run db:staging:dry-run` to confirm the history is now consistent.

## Warning: do not use service role

- Do **not** set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, Vercel, or anywhere the CLI reads from.
- `supabase db push` uses the linked project's management API and database connection string derived from the authenticated user's permissions, not a service role key.
- If a command asks for a service role key, **stop** and verify the command is correct.

## Warning: do not enable adapter until RLS smoke PASS

The following persistence adapters are **blocked** until the RLS adversarial smoke passes:

- `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha`
- Any future adapter that exposes migrated tables to the app.

Keep `REPORTS_PERSISTENCE_ADAPTER=disabled` (or unset) on all Vercel environments until then. PR #30 migrations are schema-only; they do not authorize enabling the adapter.

## Rollback / stop rules

### If dry-run looks wrong

```bash
# Do nothing. Do not run db:staging:push.
# Investigate the diff and open a new PR if the migration SQL is wrong.
```

### If push is already running and you want to abort

- `Ctrl+C` cancels the CLI command. Most `CREATE` statements are not transactional, so partial schema changes may remain.
- After a partial/cancelled push, run the post-apply verification SQL to assess state. Do not re-run blindly.

### If push succeeded but verification fails

1. Do **not** enable the adapter.
2. Do **not** merge PR #35 yet.
3. Document the failure (which object is missing/wrong, which migration version, CLI output).
4. Fix the discrepancy in a new PR or via migration repair, then re-verify.

### Code rollback (before enabling adapter)

If the migration files themselves are wrong, revert the source code change on the branch:

```bash
git revert <pr-30-merge-commit-sha>
# or open a follow-up PR with a corrected migration
```

This does **not** automatically roll back the remote staging schema. Remote schema rollback is a separate, manual operation. The safest recovery is usually to repair migration history and apply a forward-fixing migration, not to drop tables.

## Quick reference

| Goal | Command |
|------|---------|
| Authenticate CLI | `npx supabase login` |
| Link to staging | `npx supabase link --project-ref <STAGING_PROJECT_REF>` |
| Preview pending migrations | `npm run db:staging:dry-run` |
| Apply pending migrations | `npm run db:staging:push` |
| Run RLS smoke (when available) | `npm run smoke:rls` |
| List local migrations | `npx supabase migration list --linked` |

## Final recommendation for today

**Today, stop after `npm run db:staging:dry-run`.** Do not run `npm run db:staging:push` unless the founder explicitly confirms:

- They are healthy enough to review the dry-run output.
- The linked project is **Unstandard-staging**.
- The dry-run output matches the 3 PR #30 migrations exactly.

After push, run the post-apply verification SQL and wait for PR #35 RLS smoke to pass before enabling any adapter.
