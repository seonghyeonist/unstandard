# Handoff Session

## Current stack

- Neon PostgreSQL (server-only)
- Drizzle ORM + `drizzle/migrations`
- Better Auth
- Invite-only closed alpha registration
- Proof harness Artifact Version 1 (integration + smoke + combined readiness)

## Branch

`cursor/neon-drizzle-better-auth-rebuild-909d`

## Node

**24.x** (`package.json` engines + CI). Do not use Node 25+ automatically; pin stays `24.x`.

## Local commands

```bash
npm ci
npm run check
npm run guard:no-legacy-backend
npm run guard:boundaries
```

## External proof pipeline (no fabricated credentials)

```bash
# 1) Real PostgreSQL integration → machine artifact
export TEST_DATABASE_URL=<placeholder>
export DATABASE_ENV=test
export UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST=yes
export UNSTANDARD_INTEGRATION_EVIDENCE_OUT=./tmp/integration-proof.json
npm run test:integration

# 2) Deployed Preview smoke → machine artifact
export SMOKE_BASE_URL=https://<preview-hostname>.vercel.app
export SMOKE_USER_A_EMAIL=<placeholder>
export SMOKE_USER_A_PASSWORD=<placeholder>
export SMOKE_USER_B_EMAIL=<placeholder>
export SMOKE_USER_B_PASSWORD=<placeholder>
export SMOKE_USER_A_PROFILE_ID=<placeholder>
export SMOKE_USER_B_PROFILE_ID=<placeholder>
export UNSTANDARD_SMOKE_EVIDENCE_OUT=./tmp/smoke-proof.json
npm run smoke:authorization

# 3) Combine + validate readiness
export UNSTANDARD_INTEGRATION_EVIDENCE_PATH=./tmp/integration-proof.json
export UNSTANDARD_SMOKE_EVIDENCE_PATH=./tmp/smoke-proof.json
export UNSTANDARD_READINESS_EVIDENCE_OUT=./tmp/readiness-proof.json
export UNSTANDARD_EXPECTED_PREVIEW_HOSTNAME=<preview-hostname>.vercel.app
npm run readiness:evidence:build
export UNSTANDARD_READINESS_EVIDENCE_PATH=./tmp/readiness-proof.json
npm run readiness:alpha
```

Without external inputs, integration / smoke / readiness exit **2** (`BLOCKED_EXTERNAL`) and write **no** PASS artifacts.

## Honest claims

- Mock private-profile route ≠ Neon cross-user ownership proof (404 ≠ authz denial)
- Cleared local cookie ≠ revoked session; stale pre-logout replay is a separate case
- Runner `gitSha` is checkout provenance only — verify Vercel Preview deployment metadata separately
- `contentDigest` / `schemaContentDigest` are not signatures
- Integration runner deletes observation logs via try/finally (no `process.exit` after log allocation); suites run serially without shell globs
- Session-sensitive JSON (`/api/auth/session`, private-profile, unlock GET) uses `private, no-store` Cache-Control
- Without external credentials: `INTERNAL` static gates may pass while integration/smoke/readiness remain `BLOCKED_EXTERNAL` (exit 2)

## Alpha

**BLOCKED_EXTERNAL** — needs Neon test DB, Preview A/B credentials, machine-built readiness evidence, and Vercel SHA mapping for `unstandard-m9qj`.

**Platform migration:** active code path implemented; data/identity cutover `DECISION_REQUIRED`; Production cutover `NOT_STARTED`.
