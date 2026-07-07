# Staging Migration Automation — Supabase CLI

> **Target:** Unstandard-staging only.  
> **Production:** Untouchable.  
> **Goal:** Replace manual SQL Editor copy-paste for PR #30 migrations with a founder-run, dry-run-first Supabase CLI workflow.

---

## 1. Scope and rules

| Rule | Why |
|------|-----|
| **Target only Unstandard-staging** | This workflow is intentionally scoped to the staging Supabase project. |
| **Never production** | Production DB is out of scope. No script, env, or link target points to production. |
| **No adapter enable** | `REPORTS_PERSISTENCE_ADAPTER` remains `disabled` until RLS smoke passes. |
| **No service role key** | `SUPABASE_SERVICE_ROLE_KEY` is not used, requested, or logged. The CLI uses the founder's personal access token via `npx supabase login`. |
| **No migration SQL edits** | `supabase/migrations/*.sql` are applied as-is. Do not edit them in this workflow. |
| **No automatic push** | `db:staging:push` must be run manually by the founder after reviewing the dry-run. |
| **Dry-run first** | Always run `npm run db:staging:dry-run` before any real apply. |
| **SQL Editor is fallback** | Manual SQL Editor execution is documented only as a fallback, not the default. |

---

## 2. Prerequisites

- Node.js 20+ and npm.
- `npm ci` (or `npm install`) already run in the repo root.
- The founder has a Supabase account with access to the Unstandard-staging project.
- The staging project ref is known (e.g. `unstandard-staging-xxx`).

---

## 3. One-time local setup

Run these commands from the repo root.

```bash
# 1. Install Supabase CLI (already added as dev dependency by this PR)
npm install

# 2. Authenticate the CLI with the founder's personal Supabase account.
#    This opens a browser login and stores a token locally — no secret is pasted into the repo.
npx supabase login

# 3. Link the local repo to the Unstandard-staging project only.
#    Replace <STAGING_PROJECT_REF> with the actual staging project ref.
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

After `link`, the local `supabase/config.toml` contains the staging project ref.  
**Do not** commit this file if it contains project-specific values; verify `.gitignore` rules before committing.

---

## 4. Dry-run before apply

Always start with the dry-run to see exactly what SQL will be executed without touching the remote DB.

```bash
npm run db:staging:dry-run
```

This runs:

```bash
supabase db push --linked --dry-run
```

### Expected dry-run output

The CLI prints:

- Linked project ref (staging).
- Migration files that are **not yet** in `supabase_migration.schema_migrations`.
- The SQL diff that would be applied, including `CREATE EXTENSION`, `CREATE TABLE`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, and `CREATE INDEX` statements.
- A final line like:

```
DRY RUN: migrations will not be applied to the database.
```

If the output shows **no pending migrations**, the remote schema is already up to date or the migration history has diverged. See [Section 8: Migration history mismatch](#8-migration-history-mismatch).

---

## 5. Apply migrations (manual, founder-run only)

After the dry-run is reviewed and approved, run:

```bash
npm run db:staging:push
```

This runs:

```bash
supabase db push --linked
```

The CLI will:

1. Re-check the diff.
2. Ask for confirmation (`Y/n`) unless `--include-all` is used (do not use `--include-all` in this workflow).
3. Apply pending migrations in filename order.
4. Record each applied migration in `supabase_migration.schema_migrations`.

---

## 6. Post-apply verification SQL

After `db:staging:push` succeeds, open the Supabase SQL Editor for **staging** and run these verification queries. They are read-only.

```sql
-- 1. Migrations recorded in history
SELECT version, name, inserted_at
FROM supabase_migration.schema_migrations
ORDER BY inserted_at;

-- Expected rows include:
-- 0001_initial_schema
-- 0002_rls_policies
-- 0003_reports_dedup_index

-- 2. RLS is enabled on private tables
SELECT relname, relrowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
  AND relname IN (
    'profiles', 'profile_private', 'questions', 'answers',
    'depth_evaluations', 'reports', 'blocks', 'app_config',
    'events', 'unlocks', 'conversations', 'conversation_members', 'messages'
  );

-- Expected: relrowsecurity = true for all listed tables.

-- 3. RLS policies exist on critical tables
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Reports dedup index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_reports_open_dedup';
```

If any check fails, do not proceed to RLS smoke. Investigate and re-run the missing migration.

---

## 7. RLS smoke

After migration verification passes, run the adversarial RLS smoke test:

```bash
npm run smoke:rls
```

This runs:

```bash
tsx scripts/smoke/rls-adversarial.ts
```

> **Note:** The `scripts/smoke/rls-adversarial.ts` file is provided by PR #35 (`cursor/rls-adversarial-smoke-2aa9` @ `0f51c42`). PR #35 is intentionally **not merged** in this workflow. Do not merge it until the RLS smoke passes and the adapter enable decision is made separately.

---

## 8. Migration history mismatch

If migrations were previously applied manually via SQL Editor, the remote schema may match the migration files but `supabase_migration.schema_migrations` may be missing records. This causes `db push` to attempt re-applying migrations that already exist, which will fail with errors like `relation already exists` or `policy already exists`.

### Detection

- `db:staging:dry-run` shows pending migrations even though the schema looks current.
- `supabase_migration.schema_migrations` is missing rows that match the local migration files.

### Recommended action

1. **Do not run `db push` automatically.**
2. Run the [post-apply verification SQL](#6-post-apply-verification-sql) to confirm the actual schema state.
3. If the schema is genuinely missing objects, fix the root cause first (e.g. run the missing migration manually one more time, then use `supabase migration repair`).
4. If the schema is correct but history is missing, use `supabase migration repair` to mark specific migrations as applied:

```bash
# Example: mark 0001_initial_schema as already applied
npx supabase migration repair --status applied 0001_initial_schema
```

Only use `repair` after verifying the actual schema state. Never use `repair` to skip migrations that were not actually applied.

---

## 9. Stop conditions

Stop immediately and do not run `db:staging:push` if any of the following are true:

- The dry-run target is not Unstandard-staging.
- The dry-run shows unexpected migrations beyond `0001_initial_schema`, `0002_rls_policies`, and `0003_reports_dedup_index`.
- The dry-run contains SQL you do not recognize or that touches non-staging projects.
- `npx supabase status` reports the linked project is production.
- You are sick, tired, or unsure of the target. Ask for a handoff instead.

Stop and do not enable the adapter if:

- Post-apply verification SQL fails.
- `smoke:rls` fails or the script is not available.
- `REPORTS_PERSISTENCE_ADAPTER` is not explicitly set to `supabase-alpha` by a separate, approved change.

---

## 10. Rollback rules

| Scenario | Action |
|----------|--------|
| Migration applied but schema is wrong | Do not enable the adapter. Open a follow-up migration file (`0004_...sql`) to fix the schema, or use `supabase migration new` to create a reversible migration. |
| Migration partially applied | Check `supabase_migration.schema_migrations` to see which migrations succeeded. Repair history only after verifying actual schema state. |
| Need to undo everything | This workflow does not provide automatic rollback. For staging, you can drop and recreate the public schema or reset the staging project from the Supabase dashboard. Production must never be touched. |

---

## 11. Why this is safer than SQL Editor copy-paste

| Risk | SQL Editor copy-paste | Supabase CLI `db push` |
|------|----------------------|------------------------|
| Source of truth | Fragmented: local files + manual editor history | `supabase/migrations/*.sql` is the single source of truth |
| Execution order | Manual, error-prone | CLI enforces filename order and records history |
| Audit trail | None | `supabase_migration.schema_migrations` records every applied migration |
| Repetition | Same SQL can be pasted twice by mistake | CLI skips already-applied migrations |
| Scope confusion | Easy to target wrong project | `npx supabase link --project-ref <ref>` locks to one project |
| Pre-flight review | Minimal | `db push --linked --dry-run` shows the full diff before apply |

---

## 12. Final recommendation

**Today, stop after the dry-run unless the founder explicitly confirms:**

1. They are healthy enough to run destructive-looking commands.
2. The linked target is **Unstandard-staging** and nothing else.
3. They have reviewed the dry-run output and the post-apply verification SQL.

Do not run `npm run db:staging:push` without explicit founder confirmation.
