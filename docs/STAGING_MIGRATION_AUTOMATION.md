# Staging Migration Automation

> Local, founder-run Supabase CLI workflow for applying PR #30 migrations to **Unstandard-staging only**.
> This document does **not** authorize production changes, automatic pushes, or adapter enablement.

## Canonical Vercel target lock

**The only valid app host and Vercel project for this workflow:**

| Field | Required value |
|---|---|
| Vercel project | `unstandard-m9qj` |
| Host | `https://unstandard-m9qj.vercel.app` |
| `UNSTANDARD_APP_URL` | `https://unstandard-m9qj.vercel.app` |

Do not deploy, smoke-test, or collect evidence on any other Vercel project or domain. If the host is not `unstandard-m9qj.vercel.app`, **stop**.

## Ownership

| PR | Owns |
|---|---|
| **#51 (this doc)** | Supabase CLI `db push` dry-run / apply scripts only (`db:staging:dry-run`, `db:staging:push`) |
| **#35** | RLS adversarial smoke tool (`scripts/smoke/rls-adversarial.ts`, `npm run smoke:rls`) |

PR #51 does **not** ship the RLS smoke script. After Phase 2 verification PASS below, run RLS smoke from the **PR #35 branch/tool** — not from #51.

## Target & scope

- **Target database:** Unstandard-staging only.
- **Target app:** `https://unstandard-m9qj.vercel.app` only (`unstandard-m9qj` Vercel project).
- **Production is untouchable.** Never run these commands against production.
- **Adapter:** Do not enable any adapter until PR #35 RLS smoke passes.
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
| Bypasses verification guardrails | Phase 2 SQL verification + PR #35 RLS smoke are separate follow-up steps |

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

## Phase 2 verification (PR #30)

Run the following SQL in the Supabase Dashboard SQL Editor for staging **after** push:

```sql
-- 1) RLS enabled on required PR #30 tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','profile_private','questions','answers',
    'depth_evaluations','reports','blocks','events','unlocks'
  )
ORDER BY tablename;

-- 2) onboarding question seed
SELECT id, active, left(prompt, 40) AS prompt_prefix
FROM public.questions
WHERE id = '22222222-2222-2222-2222-222222222222';

-- 3) answers unique index
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'answers'
  AND indexname = 'idx_answers_user_question_unique';

-- 4) reports dedup index
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'reports'
  AND indexname = 'idx_reports_open_dedup';

-- 5) answers policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'answers'
ORDER BY policyname;

-- 6) duplicate answers must be 0 rows
SELECT user_id, question_id, COUNT(*) AS n
FROM public.answers
GROUP BY 1, 2
HAVING COUNT(*) > 1;
```

### PASS criteria

All must be true before proceeding to PR #35 RLS smoke:

- All **9** listed tables have `rowsecurity = true`.
- Seed question `22222222-2222-2222-2222-222222222222` exists and `active = true`.
- `idx_answers_user_question_unique` exists.
- `idx_reports_open_dedup` exists.
- `answers` policies are owner-scoped (inspect `qual` / `with_check` from query 5).
- Duplicate answers query (6) returns **0 rows**.
- Production untouched.
- Adapter not enabled.
- Service role not used.

If any check fails, stop. Do not run PR #35 RLS smoke. Do not enable adapter.

## RLS smoke (PR #35 — not owned by #51)

After Phase 2 verification PASS, switch to the **PR #35** branch (`cursor/rls-adversarial-smoke-2aa9`). Set `STAGING_APP_URL=https://unstandard-m9qj.vercel.app` and run:

```bash
# On PR #35 branch only — see PR #35 body for required env vars
npm run smoke:rls
```

PR #51 does not include `scripts/smoke/rls-adversarial.ts` or `smoke:rls` in `package.json`. Do not merge #51 expecting a working smoke command.

Do not enable any adapter until PR #35 RLS smoke passes on `https://unstandard-m9qj.vercel.app` only.

## Rollback and stop rules

Stop immediately and do not apply if:

- `db:staging:dry-run` fails or reports unexpected changes.
- The target is not Unstandard-staging.
- App host is not `https://unstandard-m9qj.vercel.app` (Vercel project `unstandard-m9qj`).
- You are not healthy enough to supervise the operation.
- The migration history on the remote does not match local files.
- `SUPABASE_SERVICE_ROLE_KEY` is requested or exposed.

If a push fails mid-way:

1. Do not enable any adapter.
2. Inspect the remote schema state with the Phase 2 verification SQL above.
3. Only if the schema is inconsistent, consider `supabase migration repair` after verifying the actual state.
4. Prefer fixing forward with a new migration rather than editing or rewriting already-pushed migration files.

## Warning: manual SQL Editor changes bypass migration history

If migrations were already applied manually via SQL Editor, the remote `supabase_migrations.schema_migrations` table may be missing entries even though the schema objects exist. In that case:

- `supabase db push` may fail because objects already exist.
- Do not run `supabase migration repair` until you have verified the actual schema state with the Phase 2 verification SQL above.
- If the schema matches the migration files, you can mark the migrations as applied using `supabase migration repair --status applied <version>`.
- If the schema diverges, reconcile manually under supervision and create a new migration to fix the drift.

## Warning: do not use service role

This workflow uses the authenticated developer token from `npx supabase login`. Do not export `SUPABASE_SERVICE_ROLE_KEY` or use the service role key for migrations. If the CLI asks for a service role key, stop and report it.

## Warning: do not enable adapter until RLS smoke PASS

Adapters, external integrations, or feature flags that depend on the new schema must remain disabled until:

- Phase 2 verification passes.
- PR #35 `npm run smoke:rls` passes on `https://unstandard-m9qj.vercel.app`.
- The target is confirmed as staging (`unstandard-m9qj` only).

## Final recommendation

Today, stop after the dry-run unless the founder explicitly confirms:

1. They are healthy enough to supervise.
2. The target is Unstandard-staging.

Apply only when both conditions are true.
