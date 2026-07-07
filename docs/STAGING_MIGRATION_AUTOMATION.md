# Staging Migration Automation — Supabase CLI Workflow

> **Target:** Unstandard-staging only.  
> **Production:** untouchable.  
> **Adapter enabling:** still blocked until RLS smoke passes.  
> **Service role:** never used or requested.

This document replaces the manual SQL Editor copy-paste workflow for PR #30 staging migration execution with a safer, founder-run, local Supabase CLI workflow.

## Why this is safer than SQL Editor copy-paste

| Risk | SQL Editor copy-paste | Supabase CLI `db push` |
|------|------------------------|--------------------------|
| Accidental target | Easy to paste into the wrong project tab | `supabase link` is explicit and pinned to one project ref |
| Partial execution | Copy-paste can be truncated or run out of order | CLI runs migrations in filename order, transactionally per migration |
| No audit trail | No local record of who ran what | `supabase_migration.schema_migrations` history is updated automatically |
| Reproducibility | Depends on clipboard state | `npm run db:staging:dry-run` shows exact SQL before apply |
| Rollback | Manual reverse-engineering | New corrective migration or `supabase migration repair` after verifying state |
| Environment drift | Hard to compare remote vs local | `supabase db diff` can compare linked remote to local schema |

## Hard rules

1. **Target is Unstandard-staging only.** Never run these commands against production.
2. **Do not enable any adapter** (`REPORTS_PERSISTENCE_ADAPTER`, auth mock, etc.) until RLS smoke passes.
3. **Do not use or request `SUPABASE_SERVICE_ROLE_KEY`.** Use only your own Supabase account login via `npx supabase login`.
4. **Do not edit migration SQL.** Migrations under `supabase/migrations/` are the source of truth; if they are wrong, open a new PR.
5. **Do not run `db push` automatically.** These scripts require a human to run them locally after reviewing the dry-run output.
6. **Prefer dry-run first.** Always run `npm run db:staging:dry-run` before `npm run db:staging:push`.
7. **Manual SQL Editor application is a fallback, not the default.** If you must use SQL Editor, document the exact SQL and commit a migration repair afterwards.
8. **If migrations were already manually applied to remote**, warn about migration history mismatch and recommend `supabase migration repair` only after verifying the actual schema state.
9. **Stop after dry-run today** unless you explicitly confirm you are healthy enough and the target is Unstandard-staging.

## Prerequisites

```bash
npm ci
```

The Supabase CLI is installed as a dev dependency (`npm install supabase --save-dev`). Use it via `npx` or the npm scripts below.

## One-time setup (founder-local)

```bash
# 1. Authenticate with your personal Supabase account (no service role needed)
npx supabase login

# 2. Link to the staging project only. Replace <STAGING_PROJECT_REF> with the staging project ref.
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

The link command writes the project ref to `supabase/config.toml`. Verify it:

```bash
cat supabase/config.toml | grep project_id
```

If the project_id does not match the Unstandard-staging ref, **stop** and re-link.

## Available npm scripts

```bash
# Show pending migrations and SQL that would run, but do NOT apply anything
npm run db:staging:dry-run

# Apply pending migrations to the linked staging project (human-triggered only)
npm run db:staging:push

# Run adversarial RLS smoke against the linked staging project
npm run smoke:rls
```

## Recommended execution order

### Step 1 — dry-run (stop here today unless explicitly approved)

```bash
npm run db:staging:dry-run
```

Expected dry-run output (shape):

```text
Connecting to remote database...
Checking migration history...
Version 0001_initial_schema.sql not found in migration history. Do you want to add it? [Y/n]
Version 0002_rls_policies.sql not found in migration history. Do you want to add it? [Y/n]
Version 0003_reports_dedup_index.sql not found in migration history. Do you want to add it? [Y/n]
Remote migration history is up to date.
Pending migrations:
  - 0001_initial_schema.sql
  - 0002_rls_policies.sql
  - 0003_reports_dedup_index.sql

Would you run the above migrations? [Y/n] Dry run complete. No migrations were applied.
```

**Stop conditions for dry-run:**

- If the target project does not say `Unstandard-staging` or the expected project ref, stop.
- If any migration version is missing from the remote history and you have not verified the actual schema state, stop and run verification SQL first.
- If the dry-run output includes migrations you did not expect, stop and review the branch diff.
- If you see destructive changes (e.g., `DROP TABLE`, `DROP COLUMN`) you did not author, stop.

### Step 2 — apply (only after dry-run review and explicit approval)

```bash
npm run db:staging:push
```

This command will prompt you to confirm before running. **Do not run this today unless you explicitly confirm the target is Unstandard-staging and you are healthy enough to recover from a mistake.**

### Step 3 — post-apply verification

Run these queries in the Supabase SQL Editor for the staging project only:

```sql
-- 1. Migration history matches local
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 2. Core tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'reports', 'depth_evaluations', 'app_config');

-- 3. RLS is enabled on user tables
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('profiles', 'reports', 'depth_evaluations', 'app_config')
  AND relnamespace = 'public'::regnamespace;

-- 4. Policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual::text
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected state:

- `supabase_migrations.schema_migrations` contains the versions from `supabase/migrations/`.
- `profiles`, `reports`, `depth_evaluations`, `app_config` exist in the `public` schema.
- `relrowsecurity` is `true` for `profiles`, `reports`, `depth_evaluations`, `app_config`.
- Policies match the intent in `supabase/migrations/0002_rls_policies.sql`.

### Step 4 — RLS smoke

```bash
# Required: staging project URL and publishable/anon key
# Optional: a test user email/password for authenticated probes
npm run smoke:rls
```

The smoke script (`scripts/smoke/rls-adversarial.ts`) probes:

- Anon/unauthenticated reads are blocked on `reports`, `profiles`, `depth_evaluations`.
- Anon writes are blocked on `reports`.
- Anon reads on `app_config` safe subset are allowed.
- If `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are set, authenticated probes also run:
  - Own profile read is allowed.
  - Self-report insert is allowed.
  - Inserting a report for an arbitrary target is blocked.

**Do not enable `REPORTS_PERSISTENCE_ADAPTER` or any adapter until `npm run smoke:rls` exits 0.**

## Stop conditions and rollback rules

### Stop — do not proceed

- Target is not Unstandard-staging.
- You are not the founder or a designated migration runner.
- You do not have a stable internet connection or CLI session.
- Dry-run shows unexpected migrations or destructive SQL.
- Migration history mismatch exists and you have not verified the actual schema state.
- You are not healthy enough to recover from a mistake.
- Service role key is being requested or used.
- RLS smoke has not passed.

### Rollback options

If the migration is already applied and causes a problem:

1. **Preferred:** Open a new migration file that reverses the change, review it, and run `npm run db:staging:push` again.
2. **If migration history is out of sync with actual schema** (e.g., SQL Editor was used earlier):
   ```bash
   # Verify actual schema with the post-apply SQL first, then repair history
   npx supabase migration repair --status reverted <version>
   # OR
   npx supabase migration repair --status applied <version>
   ```
   Only use `repair` after verifying the actual schema state.
3. **Nuclear option:** Restore from a Supabase backup (staging only). Production backups must not be used for staging rollback.

## Warning: manual SQL Editor changes bypass migration history

If any migration file was already applied to the remote staging database via SQL Editor copy-paste, the Supabase CLI migration history will be out of sync with the actual schema state. In that case:

- `npm run db:staging:dry-run` may report that migrations are pending even though the objects already exist.
- Running `npm run db:staging:push` may fail with `relation already exists` or similar errors.
- **Do not force the push.** Instead, run the post-apply verification SQL above and use `npx supabase migration repair` to align the history with reality.

## Warning: do not use service role

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and must not be used for migration execution or smoke testing.
- The RLS smoke script uses only the publishable/anon key (`UNSTANDARD_SUPABASE_PUBLISHABLE_KEY`).
- If you need to inspect data for debugging, use the Supabase dashboard with your own account, not the service role key.

## Warning: adapter enabling is gated

- `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha` must remain disabled until:
  1. Migrations are applied via CLI.
  2. Post-apply verification SQL confirms the expected schema and RLS state.
  3. `npm run smoke:rls` exits 0.
- Do not enable the adapter to "make it work" while RLS smoke is failing.

## Today’s recommendation

**Stop after dry-run.** Do not run `npm run db:staging:push` today unless you explicitly confirm:

1. The target is Unstandard-staging.
2. You are healthy enough to recover from a mistake.
3. You have reviewed the dry-run output and it matches the migrations in `supabase/migrations/`.
4. You have a rollback plan (backup or corrective migration ready).

## References

- [`docs/SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) — env names and migration overview
- [`docs/STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md) — P0-5 auth smoke on canonical staging
- [`docs/PERSISTENCE_BOUNDARY.md`](./PERSISTENCE_BOUNDARY.md) — adapter enabling rules
- [`docs/ALPHA_READINESS_CHECKLIST.md`](./ALPHA_READINESS_CHECKLIST.md) — P0 alpha blockers
- PR #35 smoke tool: `cursor/rls-adversarial-smoke-2aa9 @ 0f51c42` — do not merge; this script is a local minimal alternative
