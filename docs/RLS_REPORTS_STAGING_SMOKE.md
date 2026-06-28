# RLS + Reports Staging Smoke Checklist

> **Status: NOT RUN** — no human evidence captured yet.  
> **Alpha verdict remains BLOCKED** until this checklist is executed on a real Supabase staging project with recorded evidence.

This checklist is the **evidence path** for reducing one P0 alpha blocker: DB-backed reports with RLS and reporter profile bootstrap. It does **not** claim alpha-ready.

---

## 0. Scope and warnings

### In scope

- Apply existing migrations (`0001`, `0002`, `0003`) — **no new schema in this doc**
- Verify RLS on `profiles` and `reports`
- Smoke `POST /api/reports` with `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha`
- Verify reporter profile bootstrap (`profiles.id = auth.users.id`)
- Verify fail-closed behavior when adapter is disabled

### Out of scope (other branches)

- Supabase login UI
- DB-backed answers, blocks, unlock source of truth
- Real Depth Score / embeddings / matching / payments / staged reveal

### Critical gate

> **`REPORTS_PERSISTENCE_ADAPTER=supabase-alpha` must be set only after migrations and RLS are applied and verified.**  
> Do **not** enable by default in `.env.example`, Vercel Production, or shared preview until §2–§3 pass.

---

## 1. Required environment variables

Set on **staging** (Vercel Preview or local with staging Supabase project):

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Staging project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon key only — never service role |
| `AUTH_COOKIE_SECRET` | ✅ | Production/preview cookie signing |
| `REPORTS_PERSISTENCE_ADAPTER` | ✅ (for enabled smoke) | Must be exactly `supabase-alpha` when testing persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | For SQL verification in Supabase dashboard or CLI — **never** `NEXT_PUBLIC_` |

**Disabled-adapter smoke (§8):** unset `REPORTS_PERSISTENCE_ADAPTER` or set `REPORTS_PERSISTENCE_ADAPTER=disabled`. Supabase URL/key may remain set; persistence must still fail closed.

Reference: `.env.example`, [`PERSISTENCE_BOUNDARY.md`](./PERSISTENCE_BOUNDARY.md).

---

## 2. Migration apply

Existing files (do not duplicate):

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_reports_dedup_index.sql`

### Preflight (reports dedup)

Before `0003`, ensure no duplicate OPEN rows:

```sql
SELECT reporter_user_id, target_type, target_id, COUNT(*) AS n
FROM public.reports
WHERE status = 'OPEN'
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;
```

Resolve any duplicates manually before applying `0003`.

### Apply (human — pick one path)

**Supabase CLI:**

```bash
supabase link --project-ref <staging-ref>
supabase db push
```

**Direct psql (server `DATABASE_URL` from Supabase dashboard):**

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_initial_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_rls_policies.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_reports_dedup_index.sql
```

### Evidence to capture

- [ ] Command output (success, no errors)
- [ ] Screenshot or SQL: `\dt public.*` shows `profiles`, `reports`
- [ ] Git SHA of migration files applied

---

## 3. RLS policy verification

Run in Supabase SQL editor (or `psql`) as a privileged role to **list** policies; then verify **behavior** in §4–§10.

### 3a. RLS enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'reports');
```

Expected: both `rowsecurity = true`.

### 3b. Expected policy names (`profiles`)

| Policy | Command | Purpose |
|--------|---------|---------|
| `profiles_select_public` | SELECT | Public read |
| `profiles_insert_own` | INSERT | `auth.uid() = id` |
| `profiles_update_own` | UPDATE | Own row only |

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;
```

### 3c. Expected policy names (`reports`)

| Policy | Command | Purpose |
|--------|---------|---------|
| `reports_insert_own` | INSERT | `auth.uid() = reporter_user_id` |
| `reports_select_own` | SELECT | Own reports only |

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'reports'
ORDER BY policyname;
```

### 3d. Dedup index (`0003`)

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'reports'
  AND indexname = 'idx_reports_open_dedup';
```

### Evidence to capture

- [ ] SQL output for §3a–§3d
- [ ] Policy names match table above

---

## 4. Authenticated report insert smoke

**Prerequisite:** Valid Supabase session for test user A (JWT or browser cookie after auth). Login UI may still be mock-only locally — use a staging session obtained via Supabase dashboard test user + manual cookie, or temporary auth path approved for staging.

With adapter **enabled**:

```bash
export BASE_URL="https://<preview-or-local>"
export SESSION_COOKIE="<redacted-cookie-header-value>"

curl -sS -X POST "$BASE_URL/api/reports" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "targetType": "profile",
    "targetId": "c1",
    "reason": "rls_staging_smoke_first_report"
  }' | jq .
```

| Check | Expected |
|-------|----------|
| HTTP status | `201` (new OPEN report) |
| Body | `{ "ok": true, "id": "<uuid>" }` |
| DB row | `reports.reporter_user_id = auth.users.id` for user A |

```sql
SELECT id, reporter_user_id, target_type, target_id, status
FROM public.reports
WHERE reason = 'rls_staging_smoke_first_report'
ORDER BY created_at DESC
LIMIT 1;
```

### Evidence to capture

- [ ] Redacted `curl` request/response
- [ ] SQL row screenshot (IDs may be redacted)

---

## 5. Reporter profile bootstrap smoke

Test user B: **no** `profiles` row yet (`auth.users` exists).

1. Confirm missing profile:

```sql
SELECT id FROM public.profiles WHERE id = '<user-b-uuid>';
-- expect 0 rows
```

2. `POST /api/reports` as user B (same curl pattern as §4, different target/reason).

3. Verify bootstrap:

```sql
SELECT id, nickname FROM public.profiles WHERE id = '<user-b-uuid>';
```

| Check | Expected |
|-------|----------|
| Profile created | `profiles.id = auth.users.id` |
| Nickname | Non-empty; see §6 |

### Evidence to capture

- [ ] Before/after SQL for `profiles`
- [ ] Report insert succeeded (`201`)

---

## 6. Privacy smoke — nickname not from email

For user B (or any user without session nickname), inspect `profiles.nickname` after bootstrap.

| Check | Expected |
|-------|----------|
| Nickname format | `user-<8-char-uuid-prefix>` when no session nickname |
| Must NOT contain | Email local-part (e.g. user `alice@example.com` → nickname must not be `alice`) |

Unit test reference (no live Supabase):

```bash
npm run test -- tests/reporter-profile-bootstrap.test.ts
```

Look for: `does not use email local-part when nickname is missing`.

### Evidence to capture

- [ ] SQL `nickname` value (redact if needed)
- [ ] Test log snippet from `npm run test`

---

## 7. Unauthenticated report smoke

```bash
curl -sS -o /tmp/report-unauth.json -w "%{http_code}" -X POST "$BASE_URL/api/reports" \
  -H "Content-Type: application/json" \
  -d '{"targetType":"profile","targetId":"c1","reason":"should_fail"}'
```

| Check | Expected |
|-------|----------|
| HTTP status | `401` |
| Body | `{ "error": "Unauthorized" }` (or equivalent) |

### Evidence to capture

- [ ] Status code + redacted body

---

## 8. Disabled adapter smoke (fail closed)

Set `REPORTS_PERSISTENCE_ADAPTER=` (unset) or `disabled`. Redeploy or restart dev server.

Authenticated request (same as §4):

| Check | Expected |
|-------|----------|
| HTTP status | `503` |
| Body | `{ "error": "Report persistence unavailable" }` |
| DB | No new row when persistence disabled |

Unit test reference:

```bash
npm run test -- tests/reports-persistence.test.ts
```

### Evidence to capture

- [ ] Env snapshot (adapter value redacted)
- [ ] `503` response sample

---

## 9. Self-report smoke

As authenticated user A, report **own** profile id:

```bash
curl -sS -X POST "$BASE_URL/api/reports" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "{
    \"targetType\": \"profile\",
    \"targetId\": \"<user-a-uuid>\",
    \"reason\": \"self_report_smoke\"
  }" | jq .
```

| Check | Expected |
|-------|----------|
| HTTP status | `400` |
| Body | Error mentions cannot report own profile |
| DB | No new row for self-target |

Unit test reference: `lib/security/report-validation.test.ts` — `rejects self-report`.

### Evidence to capture

- [ ] `400` response (redacted)

---

## 10. Duplicate report smoke

Repeat §4 request **unchanged** (same reporter, `targetType`, `targetId`, OPEN status).

| Check | Expected |
|-------|----------|
| First request | `201` |
| Second request | `200` |
| Body both times | Same `id` |
| DB count | Single OPEN row for `(reporter_user_id, target_type, target_id)` |

```sql
SELECT COUNT(*) AS open_dupes
FROM public.reports
WHERE reporter_user_id = '<user-a-uuid>'
  AND target_type = 'profile'
  AND target_id = 'c1'
  AND status = 'OPEN';
-- expect 1
```

Constraint: `idx_reports_open_dedup` (`0003`).

### Evidence to capture

- [ ] Two response samples (`201` then `200`)
- [ ] SQL count = 1

---

## 11. Evidence bundle (required before checking ALPHA boxes)

Store in PR comment, issue, or `docs/evidence/` (gitignored) — **do not commit secrets**.

| Artifact | Description |
|----------|-------------|
| Git SHA | Commit under test |
| Preview URL | Vercel preview used (if applicable) |
| Migration log | §2 apply output |
| RLS SQL output | §3 policy listing |
| Request/response samples | §4–§10 with cookies/tokens redacted |
| Supabase screenshots | Table browser for `profiles` / `reports` |
| Unit test log | `npm run test` for pure-function guards |
| Tester + UTC timestamp | Who ran smoke, when |

After bundle is complete, a human may check the corresponding items in [`ALPHA_READINESS_CHECKLIST.md`](./ALPHA_READINESS_CHECKLIST.md). **Do not mark complete without evidence.**

---

## 12. Local pre-flight (substitute for staging — not sufficient alone)

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
```

These prove repository quality gates; they **do not** prove RLS or live Supabase behavior.

---

## 13. Related docs

- [`ALPHA_READINESS_CHECKLIST.md`](./ALPHA_READINESS_CHECKLIST.md) — P0 gate (BLOCKED)
- [`PERSISTENCE_BOUNDARY.md`](./PERSISTENCE_BOUNDARY.md) — adapter activation rules
- [`SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md) — RLS minimum table
- [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) — env and migration workflow
- [`VERCEL_PREVIEW_SMOKE.md`](./VERCEL_PREVIEW_SMOKE.md) — Edge middleware (separate blocker)
