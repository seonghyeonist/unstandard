# Neon Bootstrap Runbook

## 0. Founder cutover policy (Option B+)

Closed alpha uses **new** Better Auth accounts and **new** invites.
Do not migrate legacy hosted-BaaS application rows or identities into this runtime.
Do not delete legacy data here; any retention archive is a separate verified process.
Production cutover remains `NOT_STARTED`. See `docs/LEGACY_BACKEND_RETIREMENT.md`
(allowlisted P0.3A cutover audit).

## 1. Create Neon projects / branches (separate databases)

Provision **two** non-Production databases — do **not** reuse one for both roles:

| Role | Purpose | Env |
|------|---------|-----|
| Disposable integration | Destructive tests + cleanup only | `TEST_DATABASE_URL` + `DATABASE_ENV=test` |
| Preview application | Vercel Preview runtime + A/B accounts | `DATABASE_URL` + `DATABASE_ENV=staging` |

- Empty / non-Production
- No real users
- No copied Production data
- Production branch remains separate and untouched in this pass

Record only branch/project names in tickets — never commit connection strings.

## 2. Vercel Preview env (names only)

Canonical Vercel project for auth/deploy evidence: **`unstandard-m9qj`**.
Configure **Preview** scope only — never mutate Production env in this pass.

| Variable | Required |
|----------|----------|
| `UNSTANDARD_RUNTIME_MODE` | `database` |
| `DATABASE_ENV` | `staging` |
| `DATABASE_URL` | Preview application connection string |
| `BETTER_AUTH_SECRET` | 32+ char secret |
| `BETTER_AUTH_URL` | preview app URL |
| `UNSTANDARD_APP_URL` | preview app URL |
| `AUTH_COOKIE_SECRET` | unlock cookie secret |
| `ALPHA_INVITE_PEPPER` | optional in code; prefer explicit Preview-only value |

## 3. Migrate + seed Preview (Preview DB only)

```bash
export DATABASE_URL=<placeholder-preview-db>
export DATABASE_ENV=staging
export UNSTANDARD_CONFIRM_DB_MIGRATE=yes
npm run db:migrate
npm run db:seed
npm run db:check
```

## 4. Create alpha invites (synthetic test identities)

```bash
npm run alpha:invite:create -- --email tester@example.com
```

Under Option B+: use dedicated synthetic accounts only — never real user accounts.

## 5. Real PostgreSQL integration evidence

Uses disposable `TEST_DATABASE_URL` (not Preview app DB, not Production). Machine-writes Artifact Version 1.
The integration runner executes an explicit sorted suite inventory with `--test-concurrency=1`
(no shell glob). Proof suites share one DB and one observation JSONL, so they are serialized
even when ordinary unit tests remain parallel. Observation logs are always deleted in `finally`
(no `process.exit` after log allocation).
`migration_second_run_noop` executes the real schema snapshot twice (including the repaired
`pg_catalog` FK query).

```bash
export TEST_DATABASE_URL=<placeholder-disposable>
export DATABASE_ENV=test
export UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST=yes
export UNSTANDARD_INTEGRATION_EVIDENCE_OUT=./tmp/integration-proof.json
# optional, not default:
# export UNSTANDARD_PROOF_OVERWRITE_DIFFERENT_SHA=yes
npm run test:integration
```

## 6. Preview smoke evidence

When Preview protection is enabled, `SMOKE_VERCEL_PROTECTION_BYPASS` (or equivalent authenticated Preview access) is required for unattended smoke.

```bash
export SMOKE_BASE_URL=https://<preview-hostname>.vercel.app
export SMOKE_VERCEL_PROTECTION_BYPASS=<placeholder-if-protection-enabled>
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

This matrix does **not** prove Neon-backed private-profile A-to-B denial or DB-backed unlock HTTP authorization.

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

Combined readiness PASS is proof-harness readiness only — not overall closed-alpha launch readiness,
and the artifact does not bind Option B+ (document decision separately at the same HEAD).

See `docs/AUTHORIZATION_ADVERSARIAL_SMOKE.md` for mock private-profile honesty and session-proof distinctions.
Name-only full manifest: `.env.example`.
