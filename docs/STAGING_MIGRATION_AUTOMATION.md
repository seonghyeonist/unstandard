# Staging Migration Automation — Supabase CLI

> **Target:** Unstandard-staging only  
> **Production:** untouchable  
> **Adapter:** do not enable  
> **Service role:** do not use  
> **Scope:** PR #30 migration execution (`0001_initial_schema.sql`, `0002_rls_policies.sql`, `0003_reports_dedup_index.sql`)

This document replaces the SQL Editor copy-paste workflow with a founder-run, dry-run-first Supabase CLI workflow. It is intentionally local and manual — no GitHub Actions, no automatic push, no service role.

---

## Hard rules

1. **Target is Unstandard-staging only.** Never production.
2. **Do not enable any adapter.** `REPORTS_PERSISTENCE_ADAPTER` stays `disabled` (or unset) until RLS smoke passes.
3. **Do not use or request `SUPABASE_SERVICE_ROLE_KEY`.** Use your personal Supabase login + linked project only.
4. **Do not edit migration SQL.** The files under `supabase/migrations/` are read-only for this workflow.
5. **Do not run `db push` automatically.** `npm run db:staging:push` must be run by a human after reviewing dry-run output.
6. **Prefer dry-run first.** Always run `npm run db:staging:dry-run` before any push.
7. **If migrations were already applied manually via SQL Editor,** migration history may be out of sync. See [Migration history mismatch](#migration-history-mismatch) before pushing.

---

## One-time setup (founder machine)

### 1. Install Supabase CLI (already in dev dependencies)

```bash
npm install
```

`supabase` is listed in `devDependencies`. Use `npx supabase` to run it without a global install.

### 2. Authenticate with Supabase

```bash
npx supabase login
```

This opens a browser OAuth flow. Do not paste tokens into the terminal or commit them.

### 3. Link to Unstandard-staging only

```bash
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

Replace `<STAGING_PROJECT_REF>` with the Unstandard-staging project ref (e.g. `abcdefghijklmnopqrstuv`). This writes `supabase/config.toml` with the linked project. **Do not link to production.**

To verify the link:

```bash
npx supabase status
```

Expected output includes the linked project ref and no production reference.

---

## Dry-run (always run this first)

```bash
npm run db:staging:dry-run
```

Equivalent to:

```bash
npx supabase db push --linked --dry-run
```

### Expected dry-run output

```text
Connecting to remote database...
 difference migration 0001_initial_schema.sql
 difference migration 0002_rls_policies.sql
 difference migration 0003_reports_dedup_index.sql


-- Applying migrations --
None. The database is up to date.

```

If migrations are **not yet applied**, you will instead see SQL preview blocks such as:

```text
CREATE TABLE IF NOT EXISTS public.profiles (...);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_open_dedup ...;
```

Review every line before proceeding.

---

## Apply (human-only)

```bash
npm run db:staging:push
```

Equivalent to:

```bash
npx supabase db push --linked
```

This requires an interactive confirmation. **Do not run this in CI or automatically.**

### Stop conditions — do NOT push if any of these are true

- Dry-run output references a project other than Unstandard-staging.
- You are unsure whether SQL Editor was already used to apply migrations.
- You see unexpected tables or destructive statements (e.g., `DROP TABLE ... CASCADE`) that are not in the migration files.
- You are not healthy enough to make a production-adjacent decision.
- The target is anything other than Unstandard-staging.

---

## Post-apply verification SQL

After push succeeds, run these queries in the Supabase SQL Editor (read-only) or via `npx supabase db query` to confirm schema state:

### 1. Tables exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'profile_private', 'questions', 'answers',
    'depth_evaluations', 'reports', 'blocks', 'app_config',
    'events', 'unlocks', 'conversations', 'conversation_members', 'messages'
  )
ORDER BY table_name;
```

Expected: 13 rows.

### 2. RLS enabled on private tables

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'profile_private', 'questions', 'answers',
    'depth_evaluations', 'reports', 'blocks', 'app_config',
    'events', 'unlocks', 'conversations', 'conversation_members', 'messages'
  );
```

Expected: `rowsecurity = true` for all listed tables.

### 3. Reports dedup index exists

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_reports_open_dedup';
```

Expected: 1 row with a partial unique index on `reports (reporter_user_id, target_type, target_id) WHERE status = 'OPEN'`.

### 4. Migration history recorded

```sql
SELECT version, name, applied_at
FROM supabase_migrations.schema_migrations
ORDER BY applied_at;
```

Expected: rows matching `0001_initial_schema`, `0002_rls_policies`, and `0003_reports_dedup_index` (or later).

---

## RLS smoke command

After schema verification, run the adversarial RLS smoke test:

```bash
npm run smoke:rls
```

Equivalent to:

```bash
tsx scripts/smoke/rls-adversarial.ts
```

This script is provided by PR #35 (`cursor/rls-adversarial-smoke-2aa9`). Do not merge that PR until the smoke passes. Do not enable any persistence adapter until the smoke passes.

---

## Rollback / stop rules

### If push goes wrong

1. **Do not enable any adapter.** Keep `REPORTS_PERSISTENCE_ADAPTER` disabled.
2. **Do not use service role to fix data.** If data is corrupt, investigate first, then use targeted, reviewed SQL with a second human check if possible.
3. **Schema rollback:** If a migration is reversible (the SQL files include `DROP TABLE ... CASCADE` in reverse order), you may run a manual downgrade SQL only after verifying the schema state and recording the reason. There is no automatic `db pull` rollback.
4. **Code rollback:** If the migration itself is wrong, revert the migration file commit on the branch, then dry-run again on a fresh staging target. Do not alter already-applied remote history directly.

### If you need to stop mid-flow

- Before push: simply do not run `npm run db:staging:push`.
- After push: do not enable adapters. Run verification SQL. If anything looks wrong, stop and document before fixing.

---

## Migration history mismatch

If the migrations were already applied manually through the SQL Editor, `supabase_migrations.schema_migrations` may not contain the matching migration names. In that case `npm run db:staging:push` may fail or try to re-apply migrations.

### Recommended recovery (only after verifying actual schema state)

1. Run the post-apply verification SQL above to confirm the schema is actually correct.
2. If the schema is correct but migration history is missing, use `npx supabase migration repair` with extreme care. This updates history only; it does not run SQL.
3. Example (run only after human review):

```bash
npx supabase migration repair --status applied 0001_initial_schema
npx supabase migration repair --status applied 0002_rls_policies
npx supabase migration repair --status applied 0003_reports_dedup_index
```

4. Dry-run again to confirm history is aligned.
5. **Never repair history without first verifying the schema state.** Repairing blindly can cause future migrations to skip or fail.

---

## Warnings

### Manual SQL Editor changes bypass migration history

Running SQL directly in the Supabase SQL Editor leaves no `supabase_migrations.schema_migrations` entry. This breaks the CLI workflow and makes future `db push` results unreliable. Use SQL Editor only for post-apply verification queries (read-only) or emergency fixes after team review.

### Do not use service role

This workflow uses your personal Supabase login and publishable-key-scoped CLI operations. Do not set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, Vercel, or anywhere in this workflow. Service role bypasses RLS and is unnecessary for applying migrations.

### Do not enable adapter until RLS smoke PASS

`REPORTS_PERSISTENCE_ADAPTER` (or any other persistence adapter) must remain `disabled` until:

1. `npm run db:staging:push` succeeds on staging.
2. Post-apply verification SQL returns expected results.
3. `npm run smoke:rls` passes.

Enabling an adapter before RLS smoke passes is an alpha blocker.

---

## Final recommendation for today

1. Run setup: `npx supabase login` and `npx supabase link --project-ref <STAGING_PROJECT_REF>`.
2. Run `npm run db:staging:dry-run` and review the output carefully.
3. **Stop after dry-run unless** you explicitly confirm:
   - You are healthy enough to make this decision.
   - The target is Unstandard-staging only.
   - You have reviewed the dry-run output and post-apply verification plan.
4. Only then run `npm run db:staging:push`.

---

## Related documents

- [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) — env names and general Supabase setup
- [`STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md) — P0-5 login/logout smoke (already PASS)
- [`ALPHA_READINESS_CHECKLIST.md`](./ALPHA_READINESS_CHECKLIST.md) — P0 alpha blockers
- [`PERSISTENCE_BOUNDARY.md`](./PERSISTENCE_BOUNDARY.md) — adapter boundary rules
