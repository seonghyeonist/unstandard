# Staging Migration Automation — Supabase CLI Workflow

> **Target:** Unstandard-staging Supabase project **only**.  
> **Production:** Untouchable. Abort if production is detected.  
> **Adapter:** Do not enable any persistence/answers adapter until RLS smoke passes.  
> **Service role:** Never use `SUPABASE_SERVICE_ROLE_KEY` for this workflow.  
> **PR #30 context:** `945b739c00a2cb2043cf8da46d919b7c480dcde3` (base `main`: `12ccb77395858a3778ace4d61693bc4b29f8c503`).  
> **RLS smoke source:** `scripts/smoke/rls-adversarial.ts` (PR #35, `cursor/rls-adversarial-smoke-2aa9` @ `0f51c42`). Do not merge PR #35 into this workflow branch.

---

## 1. Safety rules (non-negotiable)

| Rule | Why |
|------|-----|
| **Staging only** | Unstandard-staging is the only acceptable target for this workflow. |
| **Never production** | If `supabase link` shows a production project ref, cancel immediately. |
| **No adapter enable** | `ANSWERS_PERSISTENCE_ADAPTER`, `REPORTS_PERSISTENCE_ADAPTER`, etc. stay **disabled** until RLS smoke passes. |
| **No service role** | User-scoped paths must use anon/publishable key + user JWT only. |
| **No migration SQL edits** | This workflow applies existing migrations; it does not rewrite them. |
| **No automatic push** | `db:staging:push` is run manually by the founder after dry-run review. |
| **Dry-run first** | Always run `npm run db:staging:dry-run` before any real push. |
| **Stop on any failure** | If dry-run or push emits an error, stop and investigate before continuing. |

---

## 2. Setup (one-time per machine)

### 2.1 Install Supabase CLI locally

Already added as a dev dependency, so the binary is available via `npx`:

```bash
npm ci
npx supabase --version
```

### 2.2 Authenticate with your Supabase account

```bash
npx supabase login
```

This opens a browser OAuth flow. Do not share the resulting token.

### 2.3 Link the project to Unstandard-staging only

```bash
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

Verify the linked project before any push:

```bash
npx supabase status
```

Expected: project name and reference must clearly indicate **staging**, not production.

---

## 3. Dry-run workflow

```bash
npm run db:staging:dry-run
```

Equivalent to:

```bash
supabase db push --linked --dry-run
```

### Expected dry-run output

```text
Connecting to remote database...
Diffing migrations from local disk against migration history table...
Remote migration versions match local migration versions.
No schema changes found.
Would apply 3 migrations ... (dry run)
  0001_initial_schema.sql
  0002_rls_policies.sql
  0003_reports_dedup_index.sql
Dry run complete. No changes were applied.
```

Actual output may vary by CLI version. The key signals are:

- Target project is **staging**.
- Listed migrations match the local `supabase/migrations/` directory.
- No error or unexpected `ALTER`/`DROP` outside the migration files.
- Line ends with **dry run / no changes applied**.

If the local migration count is 3 and the remote has 0 (or fewer), dry-run will show the pending migrations. If the remote has more, see [Section 7 — migration history mismatch](#7-migration-history-mismatch).

---

## 4. Apply workflow (only after founder approval)

**Today, stop after dry-run unless you explicitly confirm:**

1. You are healthy enough to recover from a bad push.  
2. The linked target is **Unstandard-staging**, not production.  
3. You have read the stop conditions below.

If all three are true, run:

```bash
npm run db:staging:push
```

Equivalent to:

```bash
supabase db push --linked
```

The CLI will prompt for confirmation. Read the prompt carefully before confirming.

---

## 5. Post-apply verification SQL

Run these in the Supabase SQL Editor **after** push succeeds. They are read-only checks.

### 5.1 Tables and extensions exist

```sql
SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'profile_private', 'questions', 'answers',
    'depth_evaluations', 'reports', 'blocks', 'app_config',
    'events', 'unlocks', 'conversations', 'conversation_members', 'messages'
  )
ORDER BY tablename;

SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
```

### 5.2 RLS is enabled on private tables

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'profile_private', 'answers', 'depth_evaluations',
    'reports', 'blocks', 'events', 'unlocks', 'messages',
    'conversations', 'conversation_members', 'app_config', 'questions'
  )
ORDER BY tablename;
```

All listed tables should show `rowsecurity = true`.

### 5.3 Key policies exist

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 5.4 Unique indexes exist

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_answers_user_id',
    'idx_answers_target_profile_id',
    'idx_depth_evaluations_user_id',
    'idx_reports_reporter',
    'idx_reports_open_dedup',
    'idx_events_user_id',
    'idx_messages_conversation_id'
  )
ORDER BY tablename, indexname;
```

### 5.5 Migration history table

```sql
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

This should match the local migration filenames in `supabase/migrations/`.

---

## 6. RLS adversarial smoke

After migrations are applied and verified, run the RLS adversarial smoke script. It uses anon key + real user JWTs and **never** uses service role.

### Required environment variables

```bash
export STAGING_SUPABASE_URL="https://<STAGING_PROJECT_REF>.supabase.co"
export STAGING_SUPABASE_ANON_KEY="<staging-anon-key>"
export USER_A_JWT="<user-a-jwt>"
export USER_B_JWT="<user-b-jwt>"
export TEST_QUESTION_ID="22222222-2222-2222-2222-222222222222"
export STAGING_APP_URL="https://unstandard-m9qj.vercel.app"
```

User A and User B must be distinct users in the staging project. Obtain their JWTs by signing in on staging and reading the session access token (do not paste tokens into chat or git).

### Run the smoke

```bash
npm run smoke:rls
```

Equivalent to:

```bash
tsx scripts/smoke/rls-adversarial.ts
```

### Expected result

```text
[PASS] 0-distinct-users — ...
[PASS] 1-user-a-profile — ...
[PASS] 2-user-a-answer — ...
[PASS] 3-user-b-read-user-a-answer — read blocked by RLS
[PASS] 4-user-b-update-user-a-answer — update blocked by RLS
[PASS] 5-user-b-insert-depth-eval-for-user-a — insert blocked (...)
[PASS] 6-anonymous-insert-blocked — anonymous profile and answer inserts blocked
[PASS] 7-duplicate-answer-deterministic — duplicate rejected with unique violation 23505
[PASS] 8-session-api-safe-fields — ...
[PASS] 9-protected-route-redirect — ...

RLS adversarial smoke PASSED
```

Do **not** enable any persistence adapter until this smoke passes.

---

## 7. Stop conditions

Stop immediately and do **not** run `db:staging:push` if any of the following occur:

| # | Stop condition | Action |
|---|----------------|--------|
| 1 | `npx supabase link` points to production or unknown project | `npx supabase projects list` to confirm; re-link to staging only |
| 2 | `npm run db:staging:dry-run` shows unexpected migrations (e.g., `DROP TABLE` not in migration files) | Inspect `supabase/migrations/` and the diff carefully |
| 3 | Dry-run shows remote has migrations that local does not | See [migration history mismatch](#71-migration-history-mismatch) |
| 4 | Dry-run errors with `connection refused` or SSL/TLS issues | Verify network, VPN, and that the project is active |
| 5 | Push fails mid-way | Do not retry blindly; check remote state, then either fix forward or restore from backup |
| 6 | Post-apply verification SQL shows missing tables/indexes/policies | Investigate before enabling adapter |
| 7 | RLS smoke fails | Fix RLS/policies first; do not enable adapter |
| 8 | Founder is not feeling well or unsure about the target | **Stop after dry-run** and resume later |

---

## 8. Rollback and recovery

### Before push (safe)

```bash
git restore .            # discard local working-tree changes only
git reset --soft HEAD~1  # undo a local commit but keep changes
```

### After push (staging only)

If the push is bad but data loss is acceptable for staging:

1. Run the reverse migrations in the Supabase SQL Editor (e.g., `DROP TABLE ... CASCADE` in reverse dependency order).  
2. Use `supabase migration repair` only after verifying the actual schema state (see below).  
3. For production, **never** use `DROP TABLE`; use `supabase migration repair` and a forward fix after full backup review.

### Migration history mismatch

If migrations were previously applied manually via SQL Editor, the remote `supabase_migrations.schema_migrations` table may not match local files. This causes CLI errors such as:

```text
Remote migration versions do not match local migration versions.
```

Do **not** run `supabase migration repair` automatically. First run the verification SQL in Section 5 to confirm the actual schema state. Then:

- If the schema matches the local migration content but the history table is missing rows, `supabase migration repair --status applied <version>` may be appropriate.  
- If the schema differs from the migration content, fix the schema manually (or restore from backup) before repairing history.  
- When in doubt, treat manual SQL Editor changes as a **fallback** and re-apply the correct migration set after a fresh staging reset.

---

## 9. Why this is safer than SQL Editor copy-paste

| SQL Editor copy-paste | Supabase CLI workflow |
|-----------------------|-------------------------|
| Easy to paste into wrong project (production vs. staging) | `supabase link` pins the target once; `status` verifies it |
| No dry-run step; executes immediately | `db:staging:dry-run` previews changes before any real DDL |
| No migration history entry | CLI writes `supabase_migrations.schema_migrations` for traceability |
| Manual steps are not reproducible | `npm run db:staging:push` runs the same files every time |
| Service role key often pasted into browser | Founder keeps auth in local CLI; no key in browser or chat |
| RLS smoke may be skipped | Script is integrated as `npm run smoke:rls` and gated before adapter enable |

---

## 10. Today's recommendation

**Stop after `npm run db:staging:dry-run`.** Do not run `npm run db:staging:push` unless you explicitly confirm:

- You are healthy enough to recover from a misapplied migration.  
- The linked Supabase project is **Unstandard-staging**.  
- You have read the stop conditions and rollback rules above.

Then, and only then, proceed with push and RLS smoke.
