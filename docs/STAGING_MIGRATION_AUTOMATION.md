# Staging Migration Automation (PR #30)

> Founder-run Supabase CLI workflow for applying PR #30 migrations to **Unstandard-staging only**.
> Replaces the previous SQL Editor copy-paste runbook with a version-controlled, dry-run-first, migration-history-aware process.

## Scope & Hard Rules

- **Target:** Unstandard-staging only. Never run against production.
- **Do not enable any adapter.** Migration application is independent of `ANSWERS_PERSISTENCE_ADAPTER` or any feature flag.
- **Do not use `SUPABASE_SERVICE_ROLE_KEY`.** The CLI authenticates via `npx supabase login` and uses the linked project's normal user/API access.
- **Do not edit migration SQL.** PR #30 migrations (`0004_onboarding_question_seed.sql`, `0005_answers_onboarding_hardening.sql`) are applied exactly as committed.
- **No automatic push.** `db:staging:push` is a manual founder command; `db:staging:dry-run` is always the first step.
- **Do not enable the adapter until the RLS adversarial smoke passes.**
- **No secrets pasted into the repo.** All credentials live in `.env.local` (already gitignored) or in the founder's local shell.

## Why this is safer than SQL Editor copy-paste

1. **Git is the source of truth.** The exact SQL that will run is the same SQL reviewed in PR #30.
2. **Dry-run preview.** `npm run db:staging:dry-run` prints the migrations that would be applied without changing the database.
3. **Migration history tracking.** Supabase CLI records applied versions in `supabase_migrations.schema_migrations`, so partial application, skipped files, or out-of-order runs are detected.
4. **No clipboard errors.** Eliminates copy-paste mistakes, accidental partial execution, or wrong statement selection.
5. **Founder-controlled, staged-only.** Requires explicit `npx supabase link` to a staging project ref and a separate manual push command.
6. **RLS smoke as a gate.** Post-apply verification plus an adversarial RLS smoke test confirms the security policies are effective before any code path is enabled.

## Prerequisites

- Node.js 20+ (matching `.github/workflows/ci.yml`)
- `npm ci` (installs `supabase` CLI from `devDependencies`)
- The branch containing PR #30 migrations checked out, e.g. the PR #30 branch or `main` after PR #30 is merged. The CLI reads `supabase/migrations` from the current working tree.

## Setup (one-time per local machine)

```bash
# 1. Log in to Supabase with your personal account (browser OAuth flow)
npx supabase login

# 2. Link the local repository to the Unstandard-staging project only.
#    Replace <STAGING_PROJECT_REF> with the staging project reference from the Supabase dashboard.
#    Never link to the production project.
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

`npx supabase link` creates `supabase/config.toml` and `supabase/.temp/project-ref`. Both are local; `supabase/.temp/` and `supabase/config.toml` are gitignored so they cannot be accidentally committed.

## Dry-run (always do this first)

```bash
npm run db:staging:dry-run
```

Equivalent to:

```bash
npx supabase db push --linked --dry-run
```

### Expected dry-run output for PR #30

If the staging database has migrations `0001`, `0002`, `0003` already applied and PR #30 migrations are not yet applied, the output should show exactly two pending migrations:

```text
Connecting to remote database...
Applying migration 0004_onboarding_question_seed.sql...
Applying migration 0005_answers_onboarding_hardening.sql...
Would apply 2 migrations.
```

CLI output formatting may vary by version, but the substance must be:

- Target is the linked Unstandard-staging project.
- Only `0004` and `0005` are pending.
- No errors about migration history mismatch.

## Apply (manual, only after dry-run review)

```bash
npm run db:staging:push
```

Equivalent to:

```bash
npx supabase db push --linked
```

## Post-apply verification SQL

Run these against the staging project via Supabase SQL Editor **or** `npx supabase db query` (read-only checks only) to confirm the migration result:

```sql
-- 1. PR #30 seed question exists
SELECT id, prompt, active
FROM public.questions
WHERE id = '22222222-2222-2222-2222-222222222222';

-- 2. Unique constraint/index on answers (user_id, question_id) exists
SELECT indexname
FROM pg_indexes
WHERE tablename = 'answers'
  AND indexname = 'idx_answers_user_question_unique';

-- 3. RLS policies from migration 0005 are present
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('answers', 'depth_evaluations')
ORDER BY tablename, policyname;

-- 4. RLS is enabled on the affected tables
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('answers', 'depth_evaluations', 'questions')
  AND relkind = 'r';
```

Expected results:

- One active question row with the seeded UUID.
- `idx_answers_user_question_unique` exists.
- `answers_insert_own` and `depth_evaluations_insert_own` policies exist.
- `relrowsecurity = true` for `answers`, `depth_evaluations`, and `questions`.

## RLS adversarial smoke

After the migration is applied and the verification SQL looks correct, run:

```bash
npm run smoke:rls
```

Equivalent to:

```bash
npx tsx scripts/smoke/rls-adversarial.ts
```

This script is provided by PR #35 (`cursor/rls-adversarial-smoke-2aa9`). Do not merge that PR here; only run it after it is available in your working tree. Required local environment variables (set in your shell or `.env.local`):

- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `USER_A_JWT`
- `USER_B_JWT`
- `TEST_QUESTION_ID` (defaults to `22222222-2222-2222-2222-222222222222`)
- `STAGING_APP_URL` (defaults to `https://unstandard-m9qj.vercel.app`)

**Do not enable the answers persistence adapter until this smoke reports `RLS adversarial smoke PASSED`.**

## Stop conditions — do not proceed if any of these are true

1. **Wrong target.** If `npx supabase status` or the dry-run output points to anything other than Unstandard-staging, stop immediately.
2. **Unexpected pending migrations.** If the dry-run shows migrations other than `0004` and `0005`, stop and review the branch state.
3. **Migration history mismatch.** If the CLI reports that a migration has already been applied on the remote but is missing from local history, or vice versa, stop. This usually means someone previously ran the SQL via the SQL Editor. See the next section.
4. **Dry-run errors.** Any connection error, permission error, or syntax error is a full stop.
5. **Founder cannot verify.** If you are not healthy enough to carefully read the dry-run output and confirm the target, stop after dry-run and ask for help.
6. **RLS smoke fails.** If `npm run smoke:rls` reports any `FAIL`, stop. Do not enable the adapter. Investigate the policy/state and re-run only after the failure is fixed.

## Migration history mismatch (SQL Editor fallback warning)

If PR #30 migrations were already applied manually through the Supabase SQL Editor, the remote schema may already contain the changes while `supabase_migrations.schema_migrations` does not know about `0004`/`0005`. In that case `db:staging:push` will fail or attempt to re-apply the same DDL.

**Recommended recovery (only after verifying the actual schema state):**

```bash
# 1. Inspect the current migration history
npx supabase migration list

# 2. If the schema matches the migration exactly, mark the history as applied
npx supabase migration repair --linked --status applied 0004 0005
```

Only use `repair` when you have confirmed with the verification SQL above that the migration contents are already present. If the schema diverges, do not repair; restore the remote schema from a backup or roll the migration back manually before continuing.

## Rollback / stop rules

- **Before commit:** `git restore .`
- **After commit, before push:** `git reset --soft HEAD~1`
- **After push/merge:** `git revert <sha>`
- **If a push is already in progress and you need to stop:** do not abort the CLI mid-transaction; let it finish, then assess whether to revert the schema change or repair migration history.
- **Do not `git reset --hard` or `git push --force` on a shared branch.**

## Reference

- PR #30 migrations: `supabase/migrations/0004_onboarding_question_seed.sql`, `supabase/migrations/0005_answers_onboarding_hardening.sql`
- PR #30 head: `945b739c00a2cb2043cf8da46d919b7c480dcde3`
- Base main: `12ccb77395858a3778ace4d61693bc4b29f8c503`
- RLS smoke script: PR #35 `cursor/rls-adversarial-smoke-2aa9` @ `0f51c42`
- Canonical staging app target: `https://unstandard-m9qj.vercel.app` (for app-level smoke only; the DB target is the Unstandard-staging Supabase project)

## Final recommendation

**Today, stop after `npm run db:staging:dry-run`.** Do not run `npm run db:staging:push` unless the founder explicitly confirms:

- They are healthy enough to review the output.
- The linked target is **Unstandard-staging only**.
- The dry-run shows exactly the two PR #30 migrations and no errors.
