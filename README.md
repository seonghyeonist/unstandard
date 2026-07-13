# Unstandard (closed alpha)

Next.js frontend with a **server-only** backend on Neon PostgreSQL, Drizzle ORM, and Better Auth.

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

## Architecture

| Layer | Stack |
|-------|-------|
| Database | Neon PostgreSQL |
| ORM / migrations | Drizzle + drizzle-kit |
| Auth | Self-hosted Better Auth |
| Authorization | Server session validation + domain checks + SQL constraints |
| Registration | Invite-only closed alpha |

See `docs/NEON_BOOTSTRAP_RUNBOOK.md`, `docs/BETTER_AUTH_SECURITY_MODEL.md`, and `docs/AUTHORIZATION_ADVERSARIAL_SMOKE.md`.

**Alpha verdict: BLOCKED** until Neon staging credentials, migration apply, integration tests, and deployed adversarial smoke are evidenced.
