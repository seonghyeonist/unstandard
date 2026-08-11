# Unstandard (closed alpha)

Next.js frontend with a **server-only** backend on Neon PostgreSQL, Drizzle ORM, and Better Auth.

**Node.js: 24.x** (`engines` + CI).

## Local development (mock mode)

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Default `UNSTANDARD_RUNTIME_MODE=mock` keeps the UI on mock data with dev-only mock auth.

## Database-backed local setup

```bash
export UNSTANDARD_RUNTIME_MODE=database
export DATABASE_ENV=local
export DATABASE_URL=postgresql://...
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export BETTER_AUTH_URL=http://localhost:3000
export UNSTANDARD_APP_URL=http://localhost:3000
export AUTH_COOKIE_SECRET=$(openssl rand -base64 32)
export UNSTANDARD_CONFIRM_DB_MIGRATE=yes
npm run db:migrate
npm run db:seed
npm run dev
```

Create an invite:

```bash
npm run alpha:invite:create -- --email user@example.com
```

## Quality gates

```bash
npm run check
npm run guard:no-legacy-backend
npm run guard:boundaries
```

## Proof pipeline (credentialed, exact-SHA)

| Command | Role | Evidence rule |
|---------|------|---------------|
| `npm run test` | Unit / static proof | Must PASS at the subject SHA |
| `npm run test:integration` | Real PostgreSQL integration artifact | Disposable/non-production DB only |
| `npm run smoke:authorization` | Deployed Preview HTTP artifact | Exact Preview deployment SHA + A/B credentials required |
| `npm run readiness:evidence:build` | Combine machine artifacts | Source artifacts must share SHA/checksum/host/freshness |
| `npm run readiness:alpha` | Validate combined readiness | Proof-harness verdict only; not a launch verdict |

The runtime-tested parent `2d8203e5d81275030955c81d477b39d59e6d29b7`
has machine-generated PASS evidence for PostgreSQL integration (`21/21`),
deployed Preview authorization smoke (`32/32` required), and combined readiness.
Evidence is never relabeled across commits: any later documentation or metadata
commit requires a new exact-head Preview and regenerated artifacts before merge.
Without the required credentials or target identity, external commands exit
`BLOCKED_EXTERNAL` (exit 2) and do not write a PASS artifact.

See `docs/AUTHORIZATION_ADVERSARIAL_SMOKE.md` and `docs/ALPHA_READINESS_CHECKLIST.md`.

Do not treat mock private-profile HTTP 404 as cross-user authz proof.
Do not treat a cleared CookieJar as server-side session revocation.
Do not treat redacted session JSON as publicly cacheable — session/private-profile responses are `private, no-store`.
Integration proof suites run serially against one DB + one observation log; observation cleanup uses try/finally (no `process.exit` bypass after log allocation).

## Architecture

| Layer | Stack |
|-------|-------|
| Database | Neon PostgreSQL |
| ORM / migrations | Drizzle + drizzle-kit |
| Auth | Self-hosted Better Auth |
| Authorization | Server session validation + domain checks + SQL constraints |
| Registration | Invite-only closed alpha |
| Node | 24.x |

See `docs/NEON_BOOTSTRAP_RUNBOOK.md`, `docs/BETTER_AUTH_SECURITY_MODEL.md`, and `docs/AUTHORIZATION_ADVERSARIAL_SMOKE.md`.

**Closed-alpha launch verdict: NOT_READY.** The proof harness has passed on an
exact tested parent, but that is narrower than launch readiness. Production
cutover, remaining operational checklist items, and a separate merge decision
remain open. The authoritative exact-head evidence boundary is recorded in PR
#65 and its machine artifacts for Vercel project `unstandard-m9qj`.
