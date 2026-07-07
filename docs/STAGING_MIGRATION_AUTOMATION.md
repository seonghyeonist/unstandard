# Staging Migration Automation

> Local, founder-run Supabase CLI workflow for applying PR #30 migrations to **Unstandard-staging only**.
> This document does **not** authorize production changes, automatic pushes, or adapter enablement.

## Target & scope

- **Target database:** Unstandard-staging only.
- **Production is untouchable.** Never run these commands against production.
- **Adapter:** Do not enable any adapter until the RLS smoke passes.
- **Service role:** Do not use or request `SUPABASE_SERVICE_ROLE_KEY`.
- **Migration SQL:** Do not edit migration files as part of this workflow.
- **Automation:** No GitHub Actions workflow is created yet. All pushes are manual and intentional.

## Why this is safer than SQL Editor copy-paste

| SQL Editor manual paste | Supabase CLI `db push` |
|---|---|
| No migration history on the remote | Writes to `supabase_migrations.schema_migrations` |
| Easy to paste into wrong project/target | `supabase link` locks the target to one project ref |
| No dry-run before apply | `--dry-run` shows the diff before anything runs |
| No local audit trail | SQL files are versioned in Git |
| Often requires service role for complex DDL | Uses authenticated user token via `supabase login` |
| Bypasses RLS/verification guardrails | Post-apply verification and RLS smoke are built-in steps |

## Prerequisites

- Node.js 20+ and npm.
- Access to the Unstandard-staging Supabase project (founder only).
- The migration files you intend to push are present in `supabase/migrations/` in your current branch (e.g. PR #30).

## Setup

Run once per machine:

```bash
npx supabase login
```

Link to the staging project (replace `<STAGING_PROJECT_REF>` with the actual project ref, found in Supabase Dashboard > Project Settings > General > Reference ID):

```bash
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

> Do not paste the project ref or any key into chat. The `login` command opens a browser; the `link` command only needs the public reference ID.

If the CLI says the project is not initialized, run `npx supabase init` first with the default settings, then run `npx supabase link` again. After linking, `supabase/config.toml` and `supabase/.temp/` are created locally. Do not commit `supabase/.temp/` (it is already ignored); keep `supabase/config.toml` local unless the team decides otherwise.

## Dry-run

From the branch that contains the migrations:

```bash
npm run db:staging:dry-run
```

This runs `supabase db push --linked --dry-run` and prints the SQL that would be executed. It does not modify the remote database.

### Expected output

- The CLI lists pending migrations in `supabase/migrations/`.
- It prints the SQL for each migration without executing it.
- It exits with code 0 if the diff is clean.
- If it reports "No schema changes found", either the migrations are already applied or the files are not present.

## Apply

Only after:

1. Dry-run succeeds.
2. Target is confirmed as Unstandard-staging.
3. Founder is healthy enough to supervise.
4. No adapter is enabled yet.

```bash
npm run db:staging:push
```

This runs `supabase db push --linked` and applies pending migrations.

## Post-apply verification

Run the following SQL in the Supabase Dashboard SQL Editor for staging **after** push:

```sql
-- 1. Confirm all expected migrations appear in remote history
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 2. Confirm every public table has RLS enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Fail if any public table lacks RLS
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;

-- 4. List active RLS policies
SELECT schemaname, tablename, policyname, permissive, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected:

- Migration versions match the local filenames in `supabase/migrations/`.
- All public tables show `rowsecurity = true`.
- The query in step 3 returns zero rows.
- Policies exist for every exposed table.

## RLS smoke

After the post-apply verification passes, run the adversarial RLS smoke test:

```bash
npm run smoke:rls
```

> This script is provided by PR #35 (`cursor/rls-adversarial-smoke-2aa9`). Do not merge that branch into this workflow; the smoke file must be present in your working tree before running.

Do not enable any adapter until this smoke command passes.

## Rollback and stop rules

Stop immediately and do not apply if:

- `db:staging:dry-run` fails or reports unexpected changes.
- The target is not Unstandard-staging.
- You are not healthy enough to supervise the operation.
- The migration history on the remote does not match local files.
- `SUPABASE_SERVICE_ROLE_KEY` is requested or exposed.

If a push fails mid-way:

1. Do not enable any adapter.
2. Inspect the remote schema state with the verification SQL above.
3. Only if the schema is inconsistent, consider `supabase migration repair` after verifying the actual state.
4. Prefer fixing forward with a new migration rather than editing or rewriting already-pushed migration files.

## Warning: manual SQL Editor changes bypass migration history

If migrations were already applied manually via SQL Editor, the remote `supabase_migrations.schema_migrations` table may be missing entries even though the schema objects exist. In that case:

- `supabase db push` may fail because objects already exist.
- Do not run `supabase migration repair` until you have verified the actual schema state with the verification SQL above.
- If the schema matches the migration files, you can mark the migrations as applied using `supabase migration repair --status applied <version>`.
- If the schema diverges, reconcile manually under supervision and create a new migration to fix the drift.

## Warning: do not use service role

This workflow uses the authenticated developer token from `npx supabase login`. Do not export `SUPABASE_SERVICE_ROLE_KEY` or use the service role key for migrations. If the CLI asks for a service role key, stop and report it.

## Warning: do not enable adapter until RLS smoke PASS

Adapters, external integrations, or feature flags that depend on the new schema must remain disabled until:

- Post-apply verification passes.
- `npm run smoke:rls` passes.
- The target is confirmed as staging.

## Final recommendation

Today, stop after the dry-run unless the founder explicitly confirms:

1. They are healthy enough to supervise.
2. The target is Unstandard-staging.

Apply only when both conditions are true.
