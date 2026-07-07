# Staging Migration Automation (Supabase CLI)

> Target: **Unstandard-staging only**  
> Production: **never touch**  
> Adapter: **do not enable** until RLS smoke PASS  
> Service role: **do not use or request**

This workflow replaces the manual SQL Editor copy-paste process for PR #30 staging migrations with a repeatable, founder-run Supabase CLI workflow.

---

## Why this is safer than SQL Editor copy-paste

| Risk | SQL Editor manual | Supabase CLI `db push` |
|------|-------------------|--------------------------|
| Migration history mismatch | High: remote schema changes without `supabase_migrations.schema_migrations` entry | Low: every push records the applied version |
| Accidental target | Human selects project each time | `supabase link` pins a single project ref |
| Service role exposure | Often tempted to use service role | Uses personal `supabase login` token only |
| Pre-flight verification | None | `--dry-run` shows exact SQL before it runs |
| Reproducibility | Clipboard-dependent | Git-tracked migration files in `supabase/migrations/` |
| Adapter drift | Easy to enable adapter after schema change | Adapter remains disabled until RLS smoke PASS |

---

## Prerequisites

- Node.js 20.x or 22.x
- `npm ci` completed (installs `supabase` dev dependency)
- Founder has write access to the Unstandard-staging Supabase project

---

## One-time setup

```bash
npx supabase login
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

Replace `<STAGING_PROJECT_REF>` with the Unstandard-staging project reference only.  
Do **not** link Production. If you are unsure of the ref, stop and verify in the Supabase dashboard.

---

## Dry-run (always run this first)

```bash
npm run db:staging:dry-run
```

Equivalent to:

```bash
supabase db push --linked --dry-run
```

This prints the SQL that would be applied without executing it.

### Expected dry-run output

```text
Connecting to remote database...
Applying migration 20250707120000_initial_schema...
DRY RUN: the following statements will be executed when running db push:

-- sql contents --

Would execute the following SQL:
-- (migration statements here)

Finished supabase db push.
```

If the output shows migrations that are already applied to the remote but missing locally, see [Migration history mismatch](#migration-history-mismatch) before proceeding.

---

## Apply migrations to staging

Only after a successful dry-run and explicit founder confirmation:

```bash
npm run db:staging:push
```

Equivalent to:

```bash
supabase db push --linked
```

This applies pending migrations to the **linked staging project** and records them in `supabase_migrations.schema_migrations`.

---

## Post-apply verification

Run these checks in the Supabase SQL Editor (or any read-only client) **after** push succeeds. Do not modify data; these are read-only verification queries.

```sql
-- 1. Verify all expected migrations are recorded
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 2. Spot-check tables created by the migration
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Confirm RLS is enabled on every user-facing table
SELECT relname, relrowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
  AND relname NOT LIKE 'pg_%';
```

Expected state: every production-relevant table has `relrowsecurity = true`.

---

## RLS smoke test

After schema verification, run the adversarial RLS smoke test:

```bash
npm run smoke:rls
```

Equivalent to:

```bash
tsx scripts/smoke/rls-adversarial.ts
```

This smoke test is provided by the PR #35 smoke tool (`cursor/rls-adversarial-smoke-2aa9 @ 0f51c42`). Do not merge that PR; only run the script locally against staging.

---

## Stop conditions (do not proceed if any are true)

1. The target is **not** Unstandard-staging.
2. The founder is not healthy enough to supervise the run.
3. `npm run db:staging:dry-run` shows errors, connection failures, or unexpected migrations.
4. Dry-run output references a Production project ref.
5. Any migration appears already applied on the remote but missing from local `supabase/migrations/`.
6. The RLS smoke test has **not** passed yet.
7. Someone asks you to use `SUPABASE_SERVICE_ROLE_KEY`.
8. Someone asks you to enable the adapter.

Default rule: **stop after dry-run** unless the founder explicitly confirms both health and the Unstandard-staging target.

---

## Rollback / stop rules

- **Before push:** simply do not run `npm run db:staging:push`.
- **After push:** do not run manual `DROP/ALTER` in SQL Editor. If the migration was wrong, revert the migration file, create a new corrective migration, dry-run, and push again.
- **Adapter:** keep the adapter disabled. Adapter enablement is blocked until the RLS smoke test passes.
- **Service role:** never use. If a migration fails due to permissions, fix the migration or use a privileged dashboard session, not a service role key.

---

## Migration history mismatch

If migrations were already applied manually via SQL Editor, the remote schema may exist while `supabase_migrations.schema_migrations` has no record of them. This causes `db push` to believe the migration is unapplied and may attempt to re-create objects.

### Warning signs

- Dry-run prints `CREATE TABLE` or `CREATE POLICY` for objects that already exist.
- `supabase_migrations.schema_migrations` is missing versions present in `supabase/migrations/`.

### Recommended action

1. Do **not** run `db push` automatically.
2. Verify the actual schema state with the [post-apply verification SQL](#post-apply-verification).
3. If the remote schema matches the migration intent but the history table is missing the version, consider `supabase migration repair` to mark it as applied.
4. Only run `repair` after manual verification. Repair rewrites migration history and should be done by the founder.

Example repair command (run only after verification):

```bash
npx supabase migration repair --status applied 20250707120000
```

---

## SQL Editor fallback

SQL Editor manual copy-paste is still possible as an **emergency fallback**, but it is no longer the default workflow. If you use it:

- Record every statement applied.
- Update `supabase_migrations.schema_migrations` manually or run `supabase migration repair` afterward to prevent history mismatch.
- Never use it as the routine path.

---

## Summary of commands

| Step | Command |
|------|---------|
| Setup login | `npx supabase login` |
| Link staging | `npx supabase link --project-ref <STAGING_PROJECT_REF>` |
| Dry-run | `npm run db:staging:dry-run` |
| Apply (founder confirms) | `npm run db:staging:push` |
| Verify schema | Run post-apply SQL |
| RLS smoke | `npm run smoke:rls` |

---

## Final recommendation

Today, **stop after dry-run** unless the founder explicitly confirms:

1. They are healthy enough to supervise the migration.
2. The linked target is **Unstandard-staging** and nothing else.
