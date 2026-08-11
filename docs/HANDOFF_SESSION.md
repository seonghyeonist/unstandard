# Handoff Session

## Current stack

- Neon PostgreSQL (server-only)
- Drizzle ORM + `drizzle/migrations`
- Better Auth
- Invite-only closed alpha registration
- Proof harness Artifact Version 1 (integration + smoke + combined readiness)

## Branch

`cursor/neon-drizzle-better-auth-rebuild-909d` (PR #55)

## Founder decision (Option B+)

**OPTION B+ RECORDED** — clean reset with read-only archive.

- No direct legacy hosted-BaaS application-row migrate into closed-alpha runtime
- No legacy data deletion in this workstream
- Separate read-only archive only if retention is required (archive not claimed complete until verified)
- No legacy-identity → Better Auth migrate; new accounts + new invites
- Production cutover `NOT_STARTED`

Details: `docs/LEGACY_BACKEND_RETIREMENT.md` (allowlisted P0.3A cutover audit)

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

Disposable integration DB and Preview application DB must be **separate**.

```bash
# 1) Real PostgreSQL integration → machine artifact (disposable TEST_DATABASE_URL only)
export TEST_DATABASE_URL=<placeholder>
export DATABASE_ENV=test
export UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST=yes
export UNSTANDARD_INTEGRATION_EVIDENCE_OUT=./tmp/integration-proof.json
npm run test:integration

# 2) Deployed Preview smoke → machine artifact
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

Name-only env contract: `.env.example` + `docs/NEON_BOOTSTRAP_RUNBOOK.md`.

## Honest claims

- Mock private-profile route ≠ Neon cross-user ownership proof (404 ≠ authz denial)
- Current HTTP smoke matrix does not prove DB-backed private-profile / unlock / block / profile-mutation authz
- Cleared local cookie ≠ revoked session; stale pre-logout replay is a separate case
- Runner `gitSha` is checkout provenance only — verify Vercel Preview deployment metadata separately
- Combined readiness artifact does not include / bind Option B+; record decision in docs/PR at the same HEAD
- `contentDigest` / `schemaContentDigest` are not signatures
- Integration runner deletes observation logs via try/finally (no `process.exit` after log allocation); suites run serially without shell globs
- Session-sensitive JSON (`/api/auth/session`, private-profile, unlock GET) uses `private, no-store` Cache-Control
- Without external credentials: `INTERNAL` static gates may pass while integration/smoke/readiness remain `BLOCKED_EXTERNAL` (exit 2)
- Proof-harness PASS ≠ overall closed-alpha launch readiness

## Alpha

**BLOCKED_EXTERNAL** — needs disposable Neon/test DB, separate Preview DB, Preview A/B credentials (and bypass if protection enabled), machine-built readiness evidence, and Vercel SHA mapping for `unstandard-m9qj`.

**Platform migration:** active code path implemented; **Option B+ recorded**; Production cutover `NOT_STARTED`.
