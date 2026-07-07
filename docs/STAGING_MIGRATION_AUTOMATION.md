# Staging Migration Automation — Supabase CLI

> **Target:** Unstandard-staging only.  
> **Production:** untouchable.  
> **Adapter:** do not enable.  
> **Service role:** do not use.  
> **Migration SQL:** do not edit.

This document replaces the manual SQL Editor copy-paste workflow for PR #30 staging migrations with a founder-run Supabase CLI workflow.

---

## Hard rules

| Rule | Why |
|------|-----|
| Target only `Unstandard-staging` | `supabase link` is scoped to one project ref. Production is never linked from this repo. |
| Never run `npm run db:staging:push` automatically | Push is a human decision after reviewing dry-run output. |
| Do not enable any adapter | `REPORTS_PERSISTENCE_ADAPTER` stays `disabled` (or unset) until RLS smoke passes. |
| Do not use `SUPABASE_SERVICE_ROLE_KEY` | All CLI commands and the smoke script use the publishable/anon key or the founder's own CLI auth. |
| Do not edit `supabase/migrations/*.sql` | This workflow is about applying existing migrations, not changing them. |
| Prefer dry-run first | `npm run db:staging:dry-run` shows the plan before any DDL is executed. |
| SQL Editor remains a fallback | Manual SQL Editor application is allowed only when the CLI path is blocked, and it bypasses migration history. |

---

## Prerequisites

- Node.js 20.x or 22.x
- `npm ci` completed
- Staging Supabase project ref (founder has it; do not commit it)

---

## Setup (one-time per machine)

Run these commands in the repo root. The first command opens a browser for Supabase CLI OAuth; the second links your local project to the staging project.

```bash
npx supabase login
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

After linking, verify:

```bash
npx supabase projects list
npx supabase migration list --linked
```

If the linked project is not Unstandard-staging, **stop immediately** and run:

```bash
npx supabase unlink
```

---

## Dry-run (default first step)

```bash
npm run db:staging:dry-run
```

Equivalent to:

```bash
supabase db push --linked --dry-run
```

### Expected dry-run output

The CLI prints:

- Connected project ref and DB URL (redacted host only)
- List of migrations that are **pending** on the remote
- For each migration: name, source SHA, and whether it will be applied
- A summary such as `DRY RUN: would apply N migrations`
- No actual DDL is executed

Example shape (values are illustrative):

```text
Connecting to remote database...
Connected to remote database
Pending migrations: 3
  0001_initial_schema.sql
  0002_rls_policies.sql
  0003_reports_dedup_index.sql
DRY RUN: would apply 3 migrations
```

### Dry-run stop conditions

Stop and do **not** proceed to push if any of the following is true:

- The connected project is not Unstandard-staging.
- The number of pending migrations does not match `supabase/migrations/` (3 for PR #30).
- A migration filename is unexpected or out of order.
- The CLI reports a migration history mismatch that you cannot explain.
- The dry-run output includes `ERROR` or a failed schema check.
- You are unsure whether the remote was already modified manually via SQL Editor.

If the remote was manually modified via SQL Editor, the migration history table may already be out of sync. See [Migration history mismatch](#migration-history-mismatch) before doing anything else.

---

## Apply (human decision only)

Run only after dry-run output is reviewed and confirmed safe.

```bash
npm run db:staging:push
```

Equivalent to:

```bash
supabase db push --linked
```

This executes the pending migrations against the linked staging project and records each applied migration in `supabase_migrations.schema_migrations`.

---

## Post-apply verification

Run these queries in the Supabase SQL Editor or via `supabase db query` after push succeeds.

```sql
-- 1. Migration history must contain the three PR #30 migrations.
SELECT version, name, applied_at
FROM supabase_migrations.schema_migrations
WHERE name IN (
  '0001_initial_schema',
  '0002_rls_policies',
  '0003_reports_dedup_index'
)
ORDER BY applied_at DESC;

-- 2. All expected tables exist.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'profile_private', 'questions', 'answers',
    'depth_evaluations', 'reports', 'blocks', 'app_config',
    'events', 'unlocks', 'conversations', 'conversation_members', 'messages'
  )
ORDER BY table_name;

-- 3. RLS is enabled on private tables.
SELECT relname, relrowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'profiles', 'profile_private', 'questions', 'answers',
    'depth_evaluations', 'reports', 'blocks', 'app_config',
    'events', 'unlocks', 'conversations', 'conversation_members', 'messages'
  )
ORDER BY relname;

-- 4. No duplicate OPEN reports (required before 0003; should remain empty after).
SELECT reporter_user_id, target_type, target_id, COUNT(*) AS n
FROM public.reports
WHERE status = 'OPEN'
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;
```

Expected:

- Query 1 returns exactly 3 rows.
- Query 2 returns exactly 13 rows.
- Query 3 returns `relrowsecurity = true` for every table.
- Query 4 returns 0 rows.

If any expectation fails, **do not enable the adapter** and treat the push as incomplete.

---

## RLS adversarial smoke

Run only after migrations are applied and post-apply verification passes.

```bash
npm run smoke:rls
```

Equivalent to:

```bash
tsx scripts/smoke/rls-adversarial.ts
```

### Required staging Auth config

The smoke script creates two ephemeral test users via the anon key. For the script to sign them in automatically, staging Auth → Email must have **"Enable email confirmations" disabled**. Re-enable it after the smoke if your policy requires it.

### What the smoke checks

- User A can insert and read their own `profile_private`.
- User B can read User A's public `profiles` row (public SELECT policy).
- User B **cannot** read User A's `profile_private`.
- User B **cannot** update User A's `profiles` row.
- The script never uses `SUPABASE_SERVICE_ROLE_KEY`.

### Smoke stop conditions

Stop and do not enable any adapter if:

- The smoke fails to authenticate (check email confirmation setting).
- Any check returns `FAIL`.
- The target Supabase URL is not Unstandard-staging.
- `SUPABASE_SERVICE_ROLE_KEY` is set in the environment.

---

## Migration history mismatch

If migrations were already applied manually via SQL Editor, the remote schema may match the SQL files while `supabase_migrations.schema_migrations` does not contain the corresponding entries. This causes the CLI to believe the migrations are still pending.

### Detection

```bash
npm run db:staging:dry-run
```

If the CLI reports pending migrations but the schema already exists, you have a mismatch.

### Recommended handling

1. Run the post-apply verification SQL above to confirm the actual schema state.
2. If the schema matches the migrations exactly, you may use `supabase migration repair` to mark them as applied. **Only do this after human verification.**
3. If the schema does not match, fix the schema manually (or via the SQL Editor) to match the migration files, then repair history.

Never run `supabase migration repair` blindly. It mutates migration history and can cause future `db push` operations to skip or reapply DDL incorrectly.

---

## Rollback / stop rules

| Scenario | Action |
|----------|--------|
| Dry-run looks wrong | Stop. Do not run `npm run db:staging:push`. |
| Wrong project linked | `npx supabase unlink` and re-link to Unstandard-staging only. |
| Push partially applied and broke something | Restore from a Supabase backup or run the reverse SQL from the migration file comments. Do not run arbitrary DDL without a plan. |
| RLS smoke fails | Do not enable any adapter. Investigate policies and rerun. |
| Service role key was used | Stop. Revoke/rotate the key, document the incident, and rerun the workflow with the publishable key only. |

---

## When to enable the adapter

Do **not** set `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha` (or any adapter) until:

1. `npm run db:staging:push` succeeds.
2. Post-apply verification SQL returns expected results.
3. `npm run smoke:rls` passes all checks.
4. The founder has manually confirmed the target is Unstandard-staging.

---

## Daily workflow recommendation

Today, run only the dry-run:

```bash
npm run db:staging:dry-run
```

Proceed to `npm run db:staging:push` only if the founder explicitly confirms:

- They are healthy enough to review CLI output.
- The linked target is Unstandard-staging.
- The dry-run output matches the expected 3 PR #30 migrations with no errors.
