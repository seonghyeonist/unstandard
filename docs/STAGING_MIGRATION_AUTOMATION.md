# Staging Migration Automation — Supabase CLI

> **Task:** Convert PR #30 staging migration execution from manual SQL Editor copy-paste into a safer founder-run Supabase CLI workflow.  
> **Target:** Unstandard-staging **only**.  
> **Status:** Workflow prepared; migrations are **not yet applied**.  
> **Alpha verdict:** **BLOCKED** — DB/RLS/answers/reports/blocks/unlock/rate limiting remain incomplete.

---

## Scope and hard rules

| Rule | Meaning |
|------|---------|
| Target | Unstandard-staging Supabase project only. |
| Production | Untouchable. Never link to Production for this workflow. |
| Adapter | `REPORTS_PERSISTENCE_ADAPTER` stays `disabled` until RLS smoke passes. Do not enable. |
| Service role | Do not use or request `SUPABASE_SERVICE_ROLE_KEY`. |
| Migration SQL | Do not edit `supabase/migrations/*.sql`. |
| Auto-push | No automatic `db push` in CI, cron, or scripts. |
| Workflow | No GitHub Actions workflow unless explicitly approved. |
| Dry-run first | Always run `npm run db:staging:dry-run` before `npm run db:staging:push`. |
| SQL Editor fallback | Manual SQL Editor application is a fallback, not the future default. |
| History mismatch | If migrations were already applied manually, verify actual schema state before `supabase migration repair`. |

---

## Why this is safer than SQL Editor copy-paste

- **Version-controlled source of truth:** `supabase/migrations/*.sql` is the canonical schema plan.
- **Tracked migration history:** `supabase db push` records applied versions in `supabase_migrations.schema_migrations`.
- **Preview before execute:** `npm run db:staging:dry-run` prints the exact SQL that would run without touching the remote DB.
- **No copy-paste mistakes:** Multi-file migrations run in the correct order automatically.
- **History mismatch detection:** `supabase migration list` compares local and remote state and flags manual SQL Editor drift.
- **Explicit stop gates:** Rollback/stop rules are written before any destructive command is allowed.

---

## Files involved

| File | Purpose |
|------|---------|
| `supabase/migrations/0001_initial_schema.sql` | PR #30 tables. |
| `supabase/migrations/0002_rls_policies.sql` | PR #30 RLS policies. |
| `supabase/migrations/0003_reports_dedup_index.sql` | PR #30 reports dedup index. |
| `supabase/config.toml` | Local Supabase CLI project marker (placeholder `project_id`). |
| `package.json` | `db:staging:dry-run`, `db:staging:push`, `smoke:rls` scripts. |
| `scripts/smoke/rls-adversarial.ts` | Provided by PR #35 (`cursor/rls-adversarial-smoke-2aa9 @ 0f51c42`) — **not merged yet**. |

---

## One-time setup

Run these from the repo root on the founder's machine.

```bash
# 1. Install dependencies (installs Supabase CLI from devDependencies)
npm install

# 2. If supabase/config.toml is missing, create a minimal CLI project
npx supabase init --yes

# 3. Log in to Supabase (browser flow)
npx supabase login

# 4. Link to the Unstandard-staging project only
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

- Replace `<STAGING_PROJECT_REF>` with the actual staging ref.
- Do **not** link to Production.
- `link` will update `project_id` in `supabase/config.toml`. Do not commit that local change.

---

## Dry-run (do this first)

```bash
npm run db:staging:dry-run
```

`npm run db:staging:dry-run` runs `supabase db push --linked --dry-run`.

Expected dry-run output (representative; exact wording depends on CLI version):

```text
> unstandard-alpha-web@0.1.0 db:staging:dry-run
> supabase db push --linked --dry-run

Connecting to remote database...
Remote migration history is up to date / the following migrations will be applied:
  0001_initial_schema.sql
  0002_rls_policies.sql
  0003_reports_dedup_index.sql

-- SQL preview begins here --
-- CREATE TABLE public.profiles ...
-- CREATE POLICY profiles_select_public ...
-- CREATE UNIQUE INDEX idx_reports_open_dedup ...
-- SQL preview ends here --

Dry run complete. No changes applied.
```

Stop and review if:
- Any migration name is **not** one of the three PR #30 files.
- The SQL preview contains statements you do not recognize.
- The CLI asks to connect to a project other than Unstandard-staging.

---

## Apply (only after dry-run review)

```bash
npm run db:staging:push
```

`npm run db:staging:push` runs `supabase db push --linked` and prompts for confirmation.

Do **not** run this if:
- The target is not Unstandard-staging.
- The dry-run output included unexpected migrations.
- You are not healthy enough to verify the output.
- RLS smoke has not been run.

---

## Post-apply verification SQL

Run these SELECT-only queries in the Supabase SQL Editor for the staging project.

```sql
-- 1. Migration history is recorded
SELECT version, name, applied_at
FROM supabase_migrations.schema_migrations
ORDER BY applied_at DESC;

-- 2. Expected PR #30 tables exist
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'profile_private', 'questions', 'answers', 'depth_evaluations',
    'reports', 'blocks', 'app_config', 'events', 'unlocks', 'conversations',
    'conversation_members', 'messages'
  )
ORDER BY tablename;

-- 3. RLS is enabled on private tables
SELECT relname, relrowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'profiles', 'profile_private', 'questions', 'answers', 'depth_evaluations',
    'reports', 'blocks', 'app_config', 'events', 'unlocks', 'conversations',
    'conversation_members', 'messages'
  )
ORDER BY relname;

-- 4. Reports dedup index exists
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_reports_open_dedup';

-- 5. Key policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## RLS smoke

```bash
npm run smoke:rls
```

**Prerequisite:** `scripts/smoke/rls-adversarial.ts` must exist. The adversarial RLS smoke script is provided by PR #35 (`cursor/rls-adversarial-smoke-2aa9 @ 0f51c42`), which is intentionally **not merged** yet. Do not run `npm run smoke:rls` until the script is available.

**Do not enable `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha` until RLS smoke PASS.**

---

## Rollback / stop rules

- **Stop before push** if dry-run shows any migration not in the current branch's `supabase/migrations/`.
- **Stop before push** if you are not 100% sure the target is Unstandard-staging.
- **Stop before push** if the founder is not healthy enough to review the output.
- **Do not re-run push blindly** after a failure. Inspect the error and schema state first.
- **Manual SQL Editor changes bypass migration history.** If migrations were already applied manually, run:
  ```bash
  npx supabase migration list
  ```
  Then use `npx supabase migration repair --status applied <version>` **only after** verifying the actual schema state matches the migration file.
- **Do not edit `supabase/migrations/*.sql` after they have been applied.** If a fix is needed, add a new migration.
- **Do not enable any adapter** until RLS smoke passes.
- **Do not use `SUPABASE_SERVICE_ROLE_KEY`** for this workflow.

---

## Today's recommendation

**Stop after dry-run.**

Do not run `npm run db:staging:push` unless the founder explicitly confirms **all three** of the following:

1. They are healthy enough to verify the output.
2. The target is Unstandard-staging.
3. The dry-run output has been reviewed and matches only the three PR #30 migration files.

This keeps the workflow safe while making future staging migrations repeatable.

---

## Fallback

If the CLI cannot be used (e.g. link is blocked, auth unavailable), SQL Editor remains a fallback. Document the manual run and immediately plan a `supabase migration repair` to reconcile history before the next CLI push.
