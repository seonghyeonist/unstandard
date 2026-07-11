# Staging Migration Automation

> Local, founder-run Supabase CLI workflow for applying migrations `0001`–`0006` to **Unstandard-staging only**.
> This document does **not** authorize production changes, automatic pushes, or adapter enablement.
> **Do not run `db:staging:push` until the founder replies exactly: `RUN STAGING MIGRATIONS`.**

## Execution checkout (canonical for this gate)

Prefer the temporary draft **execution branch** stacked on **PR #52** (which supersedes PR #35). That checkout must contain:

| Capability | Command / path |
|---|---|
| Migrations `0001`–`0006` | `supabase/migrations/` |
| Dry-run (read-only when linked) | `npm run db:staging:dry-run` |
| Apply (mutation — gated) | `npm run db:staging:push` |
| RLS adversarial smoke | `npm run smoke:rls` |

### Ownership / topology

| PR | Role |
|---|---|
| **#30** | Migrations `0001`–`0005` + answers persistence code (adapter **disabled**) |
| **#52** | Smoke harness + migration `0006` (supersedes **#35**) |
| **#51** | Historical source of `db:staging:*` scripts (based on `main`; incomplete alone) |
| **Execution branch** | PR #52 + PR #51 db scripts/docs reconciled — **use this for staging apply + smoke** |
| **#35** | **Historical / superseded by #52** — do not execute from #35 |

## Environment targets (do not collapse)

| Concern | Required target | Invalid |
|---|---|---|
| Database mutations | **Unstandard-staging** only | Production Supabase |
| App route / session smoke (`STAGING_APP_URL`) | Explicit **Vercel Preview** origin for PR #30/#52 | Historical Production host `unstandard-m9qj.vercel.app` for PR #30 app checks |
| P0-5 login smoke (separate gate) | Historical record on `unstandard-m9qj` — see [`STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md) | Not interchangeable with PR #30 migration evidence |

**SHA pins (do not replace one with the other):**

| Role | SHA |
|---|---|
| Current PR #30 head | `945b739c00a2cb2043cf8da46d919b7c480dcde3` |
| Code/migration execution snapshot through 0005 | `f795038533ea4cfe55bd71fdb59de68eb97e69fc` |
| PR #52 (smoke + 0006) | verify at run time (`git rev-parse`) |

## Target & scope

- **Target database:** Unstandard-staging only.
- **Production is untouchable.** Never run these commands against production.
- **Adapter:** Do not enable `ANSWERS_PERSISTENCE_ADAPTER` in this session even after PASS.
- **Service role:** Do not use or request `SUPABASE_SERVICE_ROLE_KEY`.
- **Migration SQL:** Do not edit migration files as part of apply.
- **Automation:** No GitHub Actions workflow. All pushes are manual and intentional.

## Why this is safer than SQL Editor copy-paste

| SQL Editor manual paste | Supabase CLI `db push` |
|---|---|
| No migration history on the remote | Writes to `supabase_migrations.schema_migrations` |
| Easy to paste into wrong project/target | `supabase link` locks the target to one project ref |
| No dry-run before apply | `--dry-run` shows the diff before anything runs |
| No local audit trail | SQL files are versioned in Git |
| Often requires service role for complex DDL | Uses authenticated user token via `supabase login` |
| Bypasses verification guardrails | Phase 2 SQL verification + `npm run smoke:rls` are separate follow-up steps |

## Prerequisites

- Node.js 20+ and npm.
- Access to the Unstandard-staging Supabase project (founder only).
- Checkout contains `supabase/migrations/0001`–`0006`, `db:staging:*`, and `smoke:rls`.

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

**Before link:** confirm the project name is Unstandard-staging and Production is not linked.

## Dry-run

From the execution checkout (after link):

```bash
npm run db:staging:dry-run
```

This runs `supabase db push --linked --dry-run` and prints the SQL that would be executed. It does not modify the remote database.

> If no project is linked, do **not** invent a link in an agent session. Prepare the command only and wait for founder supervision.

### Expected output

- The CLI lists pending migrations in `supabase/migrations/` (`0001`–`0006` as applicable).
- It prints the SQL for each migration without executing it.
- It exits with code 0 if the diff is clean.
- If it reports "No schema changes found", either the migrations are already applied or the files are not present.

## Apply

Only after:

1. Founder replies exactly: `RUN STAGING MIGRATIONS`
2. Dry-run succeeds against Unstandard-staging
3. Target is confirmed as Unstandard-staging (not Production)
4. Adapter remains disabled
5. No service-role key is in use

```bash
npm run db:staging:push
```

This runs `supabase db push --linked` and applies pending migrations. **Stop on first failure.**

## Phase 2 verification (after apply)

Run the following SQL in the Supabase Dashboard SQL Editor for staging **after** push. Full matrix: [`ANSWERS_RLS_ADVERSARIAL_SMOKE.md`](./ANSWERS_RLS_ADVERSARIAL_SMOKE.md) §D (D.1–D.7 + D.5b).

```sql
-- 1) RLS enabled on required tables
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

-- 5) answers policies (must include hardened update WITH CHECK after 0006)
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

All must be true before `npm run smoke:rls`:

- Listed tables have `rowsecurity = true`.
- Seed question exists and `active = true`.
- `idx_answers_user_question_unique` exists.
- `idx_reports_open_dedup` exists.
- `answers_update_own` WITH CHECK includes `target_profile_id` bound to `auth.uid()` (0006).
- Duplicate answers query returns **0 rows**.
- Production untouched.
- Adapter not enabled.
- Service role not used.

If any check fails, stop. Do not run RLS smoke. Do not enable adapter.

## RLS smoke (PR #52 harness — on this execution checkout)

After Phase 2 verification PASS, set **local** env (never commit; never paste secrets to GitHub):

- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY` (publishable — not service role)
- `USER_A_JWT` / `USER_B_JWT`
- `STAGING_APP_URL` = explicit Preview origin (**rejects** historical Production host)

```bash
npm run smoke:rls
```

**RLS PASS rule:** only PostgreSQL `42501` or explicit RLS/permission denial. `23503` and `23505` are **never** RLS PASS.

Do not enable any adapter after smoke PASS in the same session. Do not merge PR #30 / #51 / #52.

## Rollback and stop rules

Stop immediately and do not apply if:

- Founder has not replied `RUN STAGING MIGRATIONS`
- `db:staging:dry-run` fails or reports unexpected changes
- The target is not Unstandard-staging
- You are not healthy enough to supervise the operation
- The migration history on the remote does not match local files
- `SUPABASE_SERVICE_ROLE_KEY` is requested or exposed

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

Adapters that depend on the new schema must remain disabled until:

- Phase 2 verification passes.
- `npm run smoke:rls` passes with zero required SKIP/MANUAL.
- The database target is confirmed as Unstandard-staging.

Even then, adapter enablement is a **separate** founder approval — not part of this apply session.

## Final recommendation

Today, stop after preparing dry-run / static verification unless the founder explicitly replies:

```text
RUN STAGING MIGRATIONS
```
