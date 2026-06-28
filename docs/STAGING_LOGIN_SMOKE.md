# Staging Login Smoke — P0-5

> **Task:** `P0-5: Vercel/Supabase Live Login Smoke`  
> **Status:** **UNVERIFIED** — checklist only. No live evidence recorded yet.  
> **Alpha verdict:** **BLOCKED** — this smoke does not change that.  
> **Merge baseline:** `4a5153e` (PR #18 — minimal Supabase login entry)

This document is **evidence gathering**, not product expansion.  
Prove the merged login entry works on a real **Vercel Preview + Supabase staging** project.

Related (do not conflate):

- [`P0-5_SMOKE_DAY_RUNBOOK.md`](./P0-5_SMOKE_DAY_RUNBOOK.md) — **당일 실측용** 링크·순서·복붙 템플릿
- [`VERCEL_PREVIEW_SMOKE.md`](./VERCEL_PREVIEW_SMOKE.md) — Edge middleware runtime + broader preview gates
- [`ALPHA_READINESS_CHECKLIST.md`](./ALPHA_READINESS_CHECKLIST.md) — P0 alpha blockers
- [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) — env names and migration workflow

---

## Record template (fill after human-run smoke)

| Field | Value |
|-------|-------|
| Preview URL | _(e.g. `https://unstandard-xxx.vercel.app`)_ |
| Git SHA | `4a5153e` _(or newer main)_ |
| Timestamp (UTC) | _(fill)_ |
| Supabase project | _(name only, redacted ref)_ |
| Tester | _(name)_ |
| **Final verdict** | **PASS** / **NEEDS FIX** / **BLOCKED** |

---

## A. Required Vercel Preview env

Set on **Vercel → Project → Settings → Environment Variables → Preview**:

```env
UNSTANDARD_SUPABASE_URL=
UNSTANDARD_SUPABASE_PUBLISHABLE_KEY=
UNSTANDARD_SUPABASE_OAUTH_PROVIDER=
UNSTANDARD_APP_URL=
AUTH_COOKIE_SECRET=
REPORTS_PERSISTENCE_ADAPTER=disabled
```

| Variable | Required for login smoke | Notes |
|----------|--------------------------|-------|
| `UNSTANDARD_SUPABASE_URL` | ✅ | Server-only. Staging Supabase project URL. |
| `UNSTANDARD_SUPABASE_PUBLISHABLE_KEY` | ✅ | Publishable/anon key. Server route handlers only. |
| `UNSTANDARD_SUPABASE_OAUTH_PROVIDER` | ❌ | Optional. One of `github`, `google`, `apple`, `discord`. |
| `UNSTANDARD_APP_URL` | ❌ | Optional. Set to exact Preview URL if magic-link/OAuth redirect mismatches request host. |
| `AUTH_COOKIE_SECRET` | ✅ | Random server secret (unlock + cookie signing in production-like env). |
| `REPORTS_PERSISTENCE_ADAPTER` | ✅ | Must be `disabled` for this smoke. |

**Do not set for this smoke:**

- `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha`
- `SUPABASE_SERVICE_ROLE_KEY` (not used by login paths; do not add “just in case”)

**Legacy fallback (document only — not preferred):**

```env
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

New server-side auth paths prefer `UNSTANDARD_*`. Legacy `NEXT_PUBLIC_SUPABASE_*` is read-only fallback in `lib/config/supabase-config.ts`.

---

## B. Explicit forbidden env behavior

| Rule | Why |
|------|-----|
| Do **not** set `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha` | Migration + RLS smoke not done. Reports must stay 503 fail-closed. |
| Do **not** set `SUPABASE_SERVICE_ROLE_KEY` for login smoke | User-scoped auth uses publishable key + PKCE only. |
| Do **not** rely on `NEXT_PUBLIC_SUPABASE_*` for new paths | Server-only `UNSTANDARD_*` is canonical. |
| Do **not** enable mock auth on Preview | `isMockAuthAllowed()` is `false` when `NODE_ENV=production` (Vercel Preview/Prod). |

---

## C. Supabase dashboard setup (human)

### 1. Auth providers

- [ ] **Email** — enable for magic link smoke (`signInWithOtp` in `app/login/actions.ts`).
- [ ] **OAuth** (optional) — enable **one** provider first if testing `UNSTANDARD_SUPABASE_OAUTH_PROVIDER`.

### 2. Redirect URLs

Authentication → URL Configuration:

| URL | Purpose |
|-----|---------|
| `https://<VERCEL_PREVIEW_HOST>/auth/callback` | **Required** for Preview smoke |
| `http://localhost:3000/auth/callback` | Optional local smoke |

### 3. Site URL alignment

- [ ] Site URL matches `UNSTANDARD_APP_URL` when set, or the Preview deployment origin.
- [ ] If magic link lands on wrong host, set `UNSTANDARD_APP_URL` to the exact Preview URL and redeploy.

### 4. Email template (magic link)

- [ ] Confirm magic link redirect uses `/auth/callback` (Supabase default + `emailRedirectTo` in server action).

---

## D. Smoke cases

Run against a **fresh Vercel Preview deployment** after env is set.

| # | Case | Steps | Expected | Pass |
|---|------|-------|----------|------|
| 1 | `/login` loads | Open `https://<preview>/login` | 200, magic link form visible, staging copy | ☐ |
| 2 | Magic link request | Enter test email → submit | Success message; no stack trace in UI | ☐ |
| 3 | Magic link opens callback | Click link in email | Browser navigates to `/auth/callback?code=...` | ☐ |
| 4 | PKCE exchange | Complete callback | Redirect to `/app/settings`; no `auth_callback_failed` | ☐ |
| 5 | Settings reachable | Land on `/app/settings` | Page loads inside `AuthGuard` | ☐ |
| 6 | Settings shows `idPrefix` only | Read settings card | Shows 8-char prefix; **not** full UUID | ☐ |
| 7 | Session API — allowed fields | `GET /api/auth/session` (authenticated, credentials) | JSON: `nickname`, `onboarded`, `idPrefix` | ☐ |
| 8 | Session API — forbidden fields | Inspect same response | **No** `email`, `token`, `access_token`, full `id` | ☐ |
| 9 | Logout | Click logout on settings | `POST /api/auth/logout` → 200 | ☐ |
| 10 | Post-logout redirect | After logout | Protected routes redirect to `/login` | ☐ |
| 11 | Mock auth unavailable | On Preview `/login` | No mock “손님으로 시작” path (production NODE_ENV) | ☐ |
| 12 | Reports disabled | `POST /api/reports` (authenticated) | 503 persistence disabled (not 201) | ☐ |
| 13 | Alpha remains BLOCKED | Review checklist | P0 DB/RLS/unlock/block gaps still open | ☐ |

### Optional — OAuth (only if `UNSTANDARD_SUPABASE_OAUTH_PROVIDER` set)

| # | Case | Expected | Pass |
|---|------|----------|------|
| O1 | OAuth button visible | Provider name matches env | ☐ |
| O2 | `GET /api/auth/supabase/oauth?provider=<name>` | Redirect to provider; return via `/auth/callback` | ☐ |

### curl examples (replace host; use browser cookie or `-b` after login)

```bash
# Session (must be authenticated)
curl -sS -b cookies.txt "https://<preview>/api/auth/session" | jq .

# Expected shape:
# { "user": { "nickname": "...", "onboarded": true, "idPrefix": "abcdef12" } }

# Forbidden keys in response body (must be absent):
# email, access_token, refresh_token, id (full UUID)

# Logout
curl -sS -X POST -b cookies.txt "https://<preview>/api/auth/logout"

# Reports must stay disabled
curl -sS -X POST -b cookies.txt "https://<preview>/api/reports" \
  -H "Content-Type: application/json" \
  -d '{"targetType":"profile","targetId":"c1","reason":"smoke"}' \
  -w "\nHTTP %{http_code}\n"
# Expected: HTTP 503
```

---

## E. Evidence to capture

Store in PR comment, issue, or internal run log. **Never commit secrets.**

| Evidence | Format |
|----------|--------|
| Vercel Preview URL | Full HTTPS URL |
| GitHub commit SHA | e.g. `4a5153e` |
| Supabase project name | Redacted (`unstandard-staging-***`) |
| Env var **names** only | List set on Preview (no values) |
| Redirect URL screenshot | Supabase Auth → URL Configuration (redact if needed) |
| Per-case notes | Pass/fail + short note |
| Redacted `/api/auth/session` response | Paste JSON with values redacted if needed |
| Failed requests | URL, status code, error message (no tokens) |

---

## F. Final verdict options

| Verdict | When |
|---------|------|
| **PASS** | Cases 1–11 pass; session API exposes only safe fields; reports 503; no service role in client bundle |
| **NEEDS FIX** | Partial pass — e.g. redirect mismatch, callback error, session leaks field name |
| **BLOCKED** | Auth boundary broken — full id/email/token exposed, mock auth on Preview, or protected routes public |

**PASS does not mean alpha-ready.** Alpha stays **BLOCKED** until migration, RLS, DB-backed answers/unlock, blocks, and abuse guards are evidenced.

---

## Human dashboard actions (exact order)

### Vercel

1. Open **seonghyeonist/unstandard** → Vercel project.
2. **Settings → Environment Variables → Preview**.
3. Add variables from [Section A](#a-required-vercel-preview-env). Generate `AUTH_COOKIE_SECRET` (32+ random bytes).
4. Leave `REPORTS_PERSISTENCE_ADAPTER=disabled` (or unset — default is disabled).
5. **Do not** add `SUPABASE_SERVICE_ROLE_KEY` for this smoke.
6. Trigger redeploy: **Deployments → latest Preview → Redeploy** (or push empty commit to a PR branch).

### Supabase (staging project)

1. **Authentication → Providers → Email** → Enable.
2. **Authentication → URL Configuration**:
   - Site URL: `https://<preview-host>` (or `UNSTANDARD_APP_URL` value)
   - Redirect URLs: add `https://<preview-host>/auth/callback`
3. (Optional) **Authentication → Providers** → enable one OAuth provider; set `UNSTANDARD_SUPABASE_OAUTH_PROVIDER` on Vercel to match.
4. **Do not** apply migrations or enable RLS for this smoke unless separately scheduled.

### Execute smoke

1. Open Preview `/login`.
2. Walk through [Section D](#d-smoke-cases).
3. Fill [Record template](#record-template-fill-after-human-run-smoke).
4. Update [`ALPHA_READINESS_CHECKLIST.md`](./ALPHA_READINESS_CHECKLIST.md) login item with evidence link (separate PR if checklist edit needed).

---

## Local pre-flight (not a substitute for Vercel)

```bash
git checkout main && git pull --ff-only
npm ci
npm run lint
npm run typecheck
npm run test    # tsx --test — 45 tests
npm run build
npm run check
```

Local Supabase smoke (optional): copy `.env.example` → `.env.local`, set `UNSTANDARD_*`, run `npm run dev`, repeat cases against `http://localhost:3000`.

---

## Rollback

If smoke reveals a regression in merged login code:

```bash
git revert 4a5153eb96ec50b7ecc0572cd52456683100351a
# or revert specific fix commits on main — prefer git revert on shared branches
```

If smoke fails due to **env misconfiguration only**, fix env — no code revert.

---

## Code map (inspected at `4a5153e`)

| Path | Role |
|------|------|
| `app/login/page.tsx` | Server page; passes `mockAllowed`, `supabaseEnabled`, `oauthProvider` |
| `app/login/actions.ts` | `requestSupabaseMagicLink` → `signInWithOtp` |
| `app/api/auth/supabase/oauth/route.ts` | OAuth redirect |
| `app/auth/callback/route.ts` | PKCE `exchangeCodeForSession` → `/app/settings` |
| `app/api/auth/session/route.ts` | Public session: `nickname`, `onboarded`, `idPrefix` only |
| `app/api/auth/logout/route.ts` | Supabase `signOut` + mock cookie clear |
| `lib/auth/session-view.ts` | `toPublicSessionUser` — strips id/email/tokens |
| `lib/config/supabase-config.ts` | `UNSTANDARD_*` preferred; legacy fallback |
| `lib/config/auth-mode.ts` | Mock disabled in production |
| `lib/config/persistence-mode.ts` | Reports explicit-gated; default disabled |
| `middleware.ts` | Protected `/app`, `/onboarding`; Supabase session check |
