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

## Proof pipeline (external)

| Command | Role | Without credentials |
|---------|------|---------------------|
| `npm run test` | Unit / static proof | PASS locally |
| `npm run test:integration` | Real PostgreSQL integration artifact | `BLOCKED_EXTERNAL` (exit 2) |
| `npm run smoke:authorization` | Deployed Preview HTTP artifact | `BLOCKED_EXTERNAL` (exit 2) |
| `npm run readiness:evidence:build` | Combine machine artifacts | `BLOCKED_EXTERNAL` (exit 2) |
| `npm run readiness:alpha` | Validate combined readiness | `BLOCKED_EXTERNAL` (exit 2) |

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

**Alpha verdict: BLOCKED_EXTERNAL** until Neon test DB, Preview A/B smoke, combined readiness evidence, and Vercel Preview SHA mapping are evidenced for project `unstandard-m9qj`.

**Internal proof contradictions:** closed by P0.2.2 unit/static gates. External PostgreSQL + authenticated Preview A/B remain blocked without credentials.
