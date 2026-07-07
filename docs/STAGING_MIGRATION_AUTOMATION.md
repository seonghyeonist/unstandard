# Staging Migration Automation (Supabase CLI)

> **Target: Unstandard-staging only.**  
> **Production is untouchable.**  
> **Do not enable any adapter until RLS adversarial smoke passes.**

This runbook converts PR #30 staging migration execution from manual SQL Editor copy-paste into a safer, founder-run Supabase CLI workflow.

## Scope

- Applies only to the Unstandard-staging Supabase project.
- Migrations under `supabase/migrations/` are the source of truth.
- No migration SQL is edited by this workflow.
- No GitHub Actions workflow is created yet (explicit approval required).
- No service role key is used or requested.

## Prerequisites

```bash
npm install
```

## One-time setup

1. Authenticate with the Supabase CLI:

   ```bash
   npx supabase login
   ```

2. Link your local workspace to **Unstandard-staging only**:

   ```bash
   npx supabase link --project-ref <STAGING_PROJECT_REF>
   ```

   Replace `<STAGING_PROJECT_REF>` with the staging project reference.  
   **Stop if you are unsure whether the target is staging.**

3. Verify the link:

   ```bash
   npx supabase status
   ```

## Dry-run before any push

Always run a dry-run first. This shows exactly what SQL would be executed without modifying the remote database.

```bash
npm run db:staging:dry-run
```

Equivalent to:

```bash
npx supabase db push --linked --dry-run
```

### Expected dry-run output

```text
Supabase CLI 2.x.x
Connecting to remote database...
Remote migrations: 0001_initial_schema, 0002_rls_policies, 0003_reports_dedup_index
Local migrations: 0001_initial_schema, 0002_rls_policies, 0003_reports_dedup_index
No schema changes found
```

If migrations are missing on the remote, the dry-run prints the pending SQL statements and exits without applying them.

## Apply migrations

Run only after a successful dry-run and explicit confirmation that the target is Unstandard-staging.

```bash
npm run db:staging:push
```

Equivalent to:

```bash
npx supabase db push --linked
```

The CLI will prompt for confirmation before executing the migration.

## Post-apply verification

After `db:staging:push`, run the following verification SQL in the Supabase SQL Editor or via `supabase db query`:

### 1. Confirm migration history is recorded

```sql
SELECT version, name, applied_at
FROM supabase_migrations.schema_migrations
ORDER BY applied_at DESC
LIMIT 10;
```

Expected rows include `0001_initial_schema`, `0002_rls_policies`, and `0003_reports_dedup_index`.

### 2. Confirm RLS is enabled on all private tables

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

Expected: `rowsecurity = true` for every row.

### 3. Confirm reports dedup index exists

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_reports_open_dedup';
```

Expected: a unique partial index on `(reporter_user_id, target_type, target_id)` where `status = 'OPEN'`.

## RLS adversarial smoke

After the schema is applied, run the RLS adversarial smoke **before enabling any adapter**.

```bash
npm run smoke:rls
```

Required environment variables (store in `.env.local` only; never paste values into chat):

```bash
STAGING_SUPABASE_URL=https://<STAGING_PROJECT_REF>.supabase.co
STAGING_SUPABASE_ANON_KEY=<staging-anon-key>
USER_A_JWT=<jwt-for-test-user-a>
USER_B_JWT=<jwt-for-test-user-b>
TEST_QUESTION_ID=22222222-2222-2222-2222-222222222222
```

The smoke tests verify:

- Anonymous clients cannot insert into `profiles` or `answers`.
- User A can read and write their own profile and answer.
- User B cannot read or update User A's answer.

If any test fails, **stop immediately** and do not enable the adapter.

## Stop conditions

Stop and ask for help if any of the following occur:

1. **Dry-run prints errors or unexpected migrations.**
2. **Dry-run targets a project you do not recognize as Unstandard-staging.**
3. **`npm run smoke:rls` reports FAIL.**
4. **Anyone asks you to use `SUPABASE_SERVICE_ROLE_KEY`.**
5. **You are asked to enable the adapter before the RLS smoke passes.**
6. **The SQL references `production` or an unknown project reference.**
7. **You feel unsure about the target environment.**

## Rollback / recovery

- **Before push:** simply abort; no remote changes have been made.
- **After push with issues:** do not run another push blindly. Inspect the actual schema state with the verification SQL above, then use `npx supabase migration repair` only after confirming the mismatch. If the mismatch was caused by manual SQL Editor changes, see the warning below.
- **Never revert by running manual `DROP` statements from a chat window.**

## Why this is safer than SQL Editor copy-paste

- **Predictable:** `dry-run` shows the exact SQL that would run before anything is applied.
- **Auditable:** the CLI records every applied migration in `supabase_migrations.schema_migrations`, creating a clear history.
- **Local secrets:** `npx supabase login` keeps authentication on the founder's machine; no secrets are pasted into the chat.
- **No service role:** the workflow uses only the standard project link and anon/user JWTs, avoiding service role key exposure.
- **Gated:** migration push and adapter enable are separated by an explicit RLS adversarial smoke test.

## Warning: manual SQL Editor changes bypass migration history

If PR #30 migrations were already applied manually via SQL Editor, the remote `supabase_migrations.schema_migrations` table may not contain the matching rows. This causes `supabase db push` to report a mismatch or attempt to re-apply migrations.

**Recommended recovery:**

1. Run the post-apply verification SQL above to confirm the actual schema state.
2. If the schema matches the migration files but the history table is missing rows, run `npx supabase migration repair` to reconcile history **only after** verifying the schema.
3. If the schema does not match, do not run repair. Treat the remote as drifted and resolve manually with a new migration or a fresh staging reset plan.

## Today’s recommendation

Stop after `npm run db:staging:dry-run` unless the founder explicitly confirms:

- They are healthy enough to run the remaining steps.
- The linked target is definitively **Unstandard-staging**.

Do not run `npm run db:staging:push` automatically.
