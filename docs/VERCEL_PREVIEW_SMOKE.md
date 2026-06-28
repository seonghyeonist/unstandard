# Vercel Preview Smoke Checklist

> **Status (2026-06-28):** Vercel Edge middleware runtime remains **UNVERIFIED**.  
> Local `npm run build` passes but emits a Supabase Edge Runtime warning.  
> Do not deploy to production alpha until this checklist is completed on a real Vercel preview.
>
> **Login smoke (P0-5)** is a separate checklist: [`STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md).  
> Complete login smoke first; then run Edge/middleware cases below on the same Preview deployment.

---

## Why this exists

PR #11 adds `middleware.ts` with `@supabase/ssr`. `npm run build` warns:

```
@supabase/supabase-js ... process.version ... not supported in the Edge Runtime
Import trace: ... createBrowserClient.js ... @supabase/ssr
```

Build success ≠ Edge runtime success. **Preview smoke is mandatory.**

---

## Record template

| Field | Value |
|-------|-------|
| Preview URL | _(fill after deploy)_ |
| Timestamp (UTC) | _(fill)_ |
| Git SHA | `4a5153e` (or post-merge main SHA) |
| Env set used | _(see below)_ |
| Tester | _(name)_ |
| Result | PASS / FAIL / PARTIAL |

---

## Env sets to test

### A — Production fail-closed (no Supabase)

```bash
NODE_ENV=production
# NEXT_PUBLIC_SUPABASE_URL=        (unset or empty)
# NEXT_PUBLIC_SUPABASE_ANON_KEY=   (unset or empty)
AUTH_COOKIE_SECRET=<test-secret>
```

### B — Production-like Preview with Supabase (preferred server-only env)

```bash
NODE_ENV=production
UNSTANDARD_SUPABASE_URL=<project-url>
UNSTANDARD_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
AUTH_COOKIE_SECRET=<test-secret>
REPORTS_PERSISTENCE_ADAPTER=disabled
# Do NOT set SUPABASE_SERVICE_ROLE_KEY for login smoke
```

Legacy fallback (not preferred): `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Smoke steps

### 1. Middleware / protected routes

| Step | Expected | Pass |
|------|----------|------|
| `GET /app/home` (env set A) | Redirect to `/login?error=auth_not_configured` | ☐ |
| `GET /onboarding` (env set A) | Redirect to `/login?error=auth_not_configured` | ☐ |
| `GET /` (env set A) | Landing loads (200) | ☐ |
| `GET /login` (env set A) | Login page loads (200), no 500 | ☐ |
| `GET /app/home` (env set B, no session) | Redirect to `/login` | ☐ |
| Middleware request (any protected) | No Edge runtime crash in Vercel logs | ☐ |

### 2. API auth boundaries

| Step | Expected | Pass |
|------|----------|------|
| `GET /api/auth/session` (no cookie) | `{ user: null }` with 401 | ☐ |
| `GET /api/profile/c1/private` (no auth) | 401 | ☐ |
| `GET /api/profile/c1/private` (auth, locked) | 403 | ☐ |
| `POST /api/reports` (no auth) | 401 | ☐ |

### 3. Regression — secrets and private data

| Step | Expected | Pass |
|------|----------|------|
| View page source / Network → JS bundles | No private `letter` text in initial client bundle | ☐ |
| Search built client chunks for `SUPABASE_SERVICE_ROLE` | Not found | ☐ |
| Search built client chunks for `AUTH_COOKIE_SECRET` | Not found | ☐ |
| `NEXT_PUBLIC_API_BASE_URL` in client bundle | Empty or absent (default mock mode) | ☐ |

### 4. Unlock flow (dev/mock or authenticated preview)

| Step | Expected | Pass |
|------|----------|------|
| Submit unlock answer → PASS | Unlock cookie set; private API returns 200 | ☐ |
| Wrong user cannot read unlocked private content | 403 on private API | ☐ |

---

## Failure actions

| Symptom | Action |
|---------|--------|
| Middleware 500 on Edge | Block alpha deploy; review Supabase SSR middleware pattern |
| Protected routes public in production | Block merge/deploy; re-check `isProductionAuthConfigured()` |
| Service role in client bundle | Stop deploy immediately; fix import boundary |
| Private letter in client JS | Stop deploy; fix data split |

---

## Commands (local pre-flight, not a substitute for Vercel)

```bash
git checkout cursor/p0-supabase-auth-foundation  # or main after merge
npm ci
npm run test
npm run check
git restore next-env.d.ts   # if build dirtied it
```

---

## Links

- PR #18 (merged): minimal Supabase login entry — `4a5153e`
- [`docs/STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md) — P0-5 login evidence checklist
- PR #11: https://github.com/seonghyeonist/unstandard/pull/11
- `docs/TROUBLESHOOTING.md` §6 — middleware Edge warning
- `docs/SECURITY_CHECKLIST.md` — alpha gate
