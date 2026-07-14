# Neon Bootstrap Runbook

## 1. Create Neon projects

- **Staging branch** for Vercel Preview
- **Production branch** separate from staging (never share writable credentials)

Record only branch names in tickets — never commit connection strings.

## 2. Vercel Preview env (names only)

| Variable | Required |
|----------|----------|
| `UNSTANDARD_RUNTIME_MODE` | `database` |
| `DATABASE_ENV` | `staging` |
| `DATABASE_URL` | staging connection string |
| `BETTER_AUTH_SECRET` | 32+ char secret |
| `BETTER_AUTH_URL` | preview app URL |
| `UNSTANDARD_APP_URL` | preview app URL |
| `AUTH_COOKIE_SECRET` | unlock cookie secret |
| `ALPHA_INVITE_PEPPER` | optional; defaults to auth secret |

Canonical Vercel project for auth/deploy evidence: **`unstandard-m9qj`**.

## 3. Migrate + seed staging

```bash
export DATABASE_ENV=staging
export UNSTANDARD_CONFIRM_DB_MIGRATE=yes
npm run db:migrate
npm run db:seed
npm run db:check
```

## 4. Create alpha invites

```bash
npm run alpha:invite:create -- --email tester@example.com
```

## 5. Real PostgreSQL integration evidence

Uses a disposable `TEST_DATABASE_URL` (not Production). Machine-writes Artifact Version 1.

```bash
export TEST_DATABASE_URL=<placeholder-disposable>
export DATABASE_ENV=test
export UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST=yes
export UNSTANDARD_INTEGRATION_EVIDENCE_OUT=./tmp/integration-proof.json
npm run test:integration
```

## 6. Preview smoke evidence

```bash
export SMOKE_BASE_URL=https://<preview-hostname>.vercel.app
export SMOKE_USER_A_EMAIL=<placeholder>
export SMOKE_USER_A_PASSWORD=<placeholder>
export SMOKE_USER_B_EMAIL=<placeholder>
export SMOKE_USER_B_PASSWORD=<placeholder>
export SMOKE_USER_A_PROFILE_ID=<placeholder>
export SMOKE_USER_B_PROFILE_ID=<placeholder>
export UNSTANDARD_SMOKE_EVIDENCE_OUT=./tmp/smoke-proof.json
npm run smoke:authorization
```

Hostname must be Preview (not Production `unstandard-m9qj.vercel.app`, not main alias).
Operator must separately confirm the Vercel deployment commit SHA matches the runner HEAD.

## 7. Combined readiness

```bash
export UNSTANDARD_INTEGRATION_EVIDENCE_PATH=./tmp/integration-proof.json
export UNSTANDARD_SMOKE_EVIDENCE_PATH=./tmp/smoke-proof.json
export UNSTANDARD_READINESS_EVIDENCE_OUT=./tmp/readiness-proof.json
export UNSTANDARD_EXPECTED_PREVIEW_HOSTNAME=<preview-hostname>.vercel.app
npm run readiness:evidence:build
export UNSTANDARD_READINESS_EVIDENCE_PATH=./tmp/readiness-proof.json
npm run readiness:alpha
```

Freshness window: 24h. Clock skew allowance: 5 minutes. Node: **24.x**.

See `docs/AUTHORIZATION_ADVERSARIAL_SMOKE.md` for mock private-profile honesty and session-proof distinctions.
