# Staging Migration Automation (Supabase CLI)

> Target: **Unstandard-staging only**  
> Production: **untouchable**  
> Adapter: **do not enable**  
> Service role: **do not use**

This document defines the founder-run local workflow for applying PR #30 migrations to the Unstandard-staging Supabase project using the Supabase CLI.

## Why this replaces SQL Editor copy/paste

- Migrations live in `supabase/migrations/` as version-controlled files.
- `supabase db push --linked --dry-run` shows exactly what SQL will run before anything is applied.
- The CLI records applied migrations in `supabase_migrations.schema_migrations`, preventing duplicate or missed runs.
- No manual copy/paste of long SQL blocks, so partial or wrong-file execution is eliminated.
- Runs under the founder's own authenticated account via `supabase login`; no `SUPABASE_SERVICE_ROLE_KEY` is required.
- The project is explicitly linked to one staging project ref, so the target cannot drift to production.

## Prerequisites

- Node.js and npm installed in this repo.
- `npm install` has been run (so `supabase` and `tsx` are available in `node_modules`).
- Access to the **Unstandard-staging** Supabase project as a user with permission to run migrations.

## One-time setup

1. Log in to Supabase from your local machine:

   ```bash
   npx supabase login
   ```

2. Link the local repo to the Unstandard-staging project:

   ```bash
   npx supabase link --project-ref <STAGING_PROJECT_REF>
   ```

   Replace `<STAGING_PROJECT_REF>` with the actual staging project reference (e.g. `abcdefgh12345678`).  
   **Do not use the production project ref.**

3. Verify the link:

   ```bash
   npx supabase status
   ```

## Dry-run (always do this first)

```bash
npm run db:staging:dry-run
```

This runs:

```bash
supabase db push --linked --dry-run
```

Expected output shape:

```text
Connecting to remote database...
Connected to remote database.
Would run migration 0001_initial_schema.sql:
-- <SQL preview here>
Would run migration 0002_rls_policies.sql:
-- <SQL preview here>
...
No migrations were applied.
```

Review every line of the SQL preview. If anything looks unexpected, **stop** and investigate before applying.

## Apply migrations

Only after the dry-run output has been reviewed and approved:

```bash
npm run db:staging:push
```

This runs:

```bash
supabase db push --linked
```

You will be prompted to confirm before destructive changes are applied. Read the prompt carefully.

## Post-apply verification

After `db:staging:push` succeeds, run the following checks in the Supabase SQL Editor (now used only for verification, not for applying migrations):

### 1. Migration history is recorded

```sql
select version, name, applied_at
from supabase_migrations.schema_migrations
order by applied_at desc;
```

Expected: every file in `supabase/migrations/` appears exactly once with a recent `applied_at` timestamp.

### 2. Key tables exist

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'answers', 'reports', 'blocks', 'unlocks');
```

Expected: all expected tables are present. (Adjust the list to match the actual schema.)

### 3. RLS is enabled on sensitive tables

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'answers', 'reports', 'blocks', 'unlocks');
```

Expected: `rowsecurity = true` for every listed table.

### 4. Policies are present

```sql
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Expected: the policies defined in `0002_rls_policies.sql` are present.

## RLS adversarial smoke

Run the RLS smoke tool from PR #35 (`cursor/rls-adversarial-smoke-2aa9 @ 0f51c42`).  
The npm script expects the smoke file at `scripts/smoke/rls-adversarial.ts`.

```bash
npm run smoke:rls
```

Expected result: **all assertions PASS**.

**Do not enable the adapter until the RLS smoke passes.** If the smoke fails, fix the schema or policies first, then re-run smoke before enabling any downstream feature.

## Rollback / stop rules

1. **Stop after dry-run today** unless the founder explicitly confirms:
   - They are healthy enough to supervise an apply.
   - The linked target is Unstandard-staging and nothing else.
2. **Never run `db:staging:push` on production.** The script only works when linked to staging; do not relink to production for this purpose.
3. **If a migration fails mid-run, stop.** Do not run manual SQL Editor patches to "fix" the state. Open an incident thread and decide whether to use `supabase migration repair` after verifying the actual remote schema.
4. **If the schema is already out of sync with the migration files**, do not blindly push. Run `supabase db diff --linked` to inspect the drift, then use `supabase migration repair` only after confirming the real schema state.
5. **Do not use `SUPABASE_SERVICE_ROLE_KEY`**. The CLI uses your personal authenticated session, which is subject to Supabase project-level permissions.
6. **Do not enable the adapter until RLS smoke passes.** The adapter is a separate feature gate and is not part of this migration workflow.

## Warning: manual SQL Editor changes bypass migration history

If migrations were already applied manually through the SQL Editor, the `supabase_migrations.schema_migrations` table may not reflect the actual schema state. This creates a **migration history mismatch**.

Symptoms:

- `supabase db push --linked --dry-run` reports that migrations would run even though the objects already exist.
- Applying them again may fail with `already exists` or similar errors.
- Future teammates may trust the migration history and miss the fact that the remote state was manually altered.

Recommended remediation:

1. Do **not** run `db:staging:push` yet.
2. Compare the live schema with `supabase/migrations/` using `supabase db diff --linked`.
3. If the diff confirms the migrations are already applied, use `supabase migration repair --status reverted <version>` or `supabase migration repair --status applied <version>` **only** to align history with reality.
4. Re-run `npm run db:staging:dry-run` and confirm it reports nothing to apply.

## Commands summary

| Step | Command |
|------|---------|
| Login | `npx supabase login` |
| Link staging | `npx supabase link --project-ref <STAGING_PROJECT_REF>` |
| Dry-run | `npm run db:staging:dry-run` |
| Apply | `npm run db:staging:push` |
| RLS smoke | `npm run smoke:rls` |
| Inspect drift | `npx supabase db diff --linked` |
| Repair history | `npx supabase migration repair --status applied <version>` |

## Final recommendation

Today, run only the dry-run. Do not apply (`db:staging:push`) unless the founder explicitly confirms they are healthy enough and the linked target is Unstandard-staging. Keep production untouched, keep the adapter disabled, and never use the service role key.
