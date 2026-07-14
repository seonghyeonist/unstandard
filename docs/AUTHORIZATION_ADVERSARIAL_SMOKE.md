# Authorization Adversarial Smoke

HTTP-boundary smoke for the **deployed Alpha Preview HTTP surface only**.

DB-only proofs (FK constraints, uniqueness, invite finalization, migration/seed)
belong in `npm run test:integration` against a disposable `TEST_DATABASE_URL`.
That integration evidence is **real PostgreSQL**, not Neon Production evidence.

## Proof tiers (do not conflate)

| Tier | Command | Proves |
|------|---------|--------|
| Static / unit / build | `npm run lint`, `typecheck`, `test`, `build`, guards | Code compiles and unit contracts hold |
| Real PostgreSQL integration | `npm run test:integration` | Observed DB assertions on a test database |
| Deployed Preview HTTP smoke | `npm run smoke:authorization` | A/B session + report HTTP boundaries on Preview |
| Combined readiness | `npm run readiness:evidence:build` then `npm run readiness:alpha` | Both source artifacts PASS, matching SHA/checksum/host/freshness |

No manually authored PASS JSON is trusted. Artifacts are machine-generated.

## Session proofs (three distinct cases)

| Case | What it proves |
|------|----------------|
| `logout_invalidates_session` | Sign-in → session 200 → real logout → post-logout jar → session 401 |
| `cleared_cookie_denied` | Sign-in → clear **local** CookieJar only (no logout) → session 401 (anonymous / cookieless) |
| `revoked_session_rejected` | Sign-in → clone stale pre-logout CookieJar → logout on live jar → replay stale jar → session 401 |

Do not call a locally cleared cookie “revoked”. Only the stale pre-logout replay case may be named `revoked_session_rejected`.

## Mock private-profile route (not DB ownership proof)

`GET /api/profile/[id]/private`:

- uses **mock** `publicProfiles` IDs (`c1`/`c2`/`c3`), not Neon profile UUID ownership
- authorizes via **unlock cookie**, not DB unlock rows
- does **not** establish Neon User A vs User B ownership isolation
- **HTTP 404 is not authorization denial** (unknown mock ID ≠ forbidden)

Therefore `user_a_cannot_read_user_b_private_profile` is **removed** from the required matrix.

Future / not applicable:

- `db_backed_cross_user_private_profile_denial` — until a Neon-backed private-profile route exists
- `private_mock_profile_requires_unlock_cookie` — informational mock-contract only (not Alpha-required)

## Commands

### Smoke (deployed Preview)

```bash
export SMOKE_BASE_URL=https://<preview-hostname>.vercel.app
# optional when Preview protection is on:
export SMOKE_VERCEL_PROTECTION_BYPASS=<placeholder>
export SMOKE_USER_A_EMAIL=<placeholder>
export SMOKE_USER_A_PASSWORD=<placeholder>
export SMOKE_USER_B_EMAIL=<placeholder>
export SMOKE_USER_B_PASSWORD=<placeholder>
export SMOKE_USER_A_PROFILE_ID=<placeholder>
export SMOKE_USER_B_PROFILE_ID=<placeholder>
export UNSTANDARD_SMOKE_EVIDENCE_OUT=./tmp/smoke-proof.json
npm run smoke:authorization
```

Missing Preview URL, A/B credentials, profile IDs, or required bypass → `BLOCKED_EXTERNAL` (exit 2), **no PASS artifact**.

### Integration (real PostgreSQL)

```bash
export TEST_DATABASE_URL=<placeholder-disposable-db>
export DATABASE_ENV=test
export UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST=yes
export UNSTANDARD_INTEGRATION_EVIDENCE_OUT=./tmp/integration-proof.json
npm run test:integration
```

Missing `TEST_DATABASE_URL` or destructive confirmation → `BLOCKED_EXTERNAL` (exit 2), **no PASS artifact**.

Operator override (not default): `UNSTANDARD_PROOF_OVERWRITE_DIFFERENT_SHA=yes` allows overwriting a PASS artifact from a different git SHA.

### Combined readiness evidence

```bash
export UNSTANDARD_INTEGRATION_EVIDENCE_PATH=./tmp/integration-proof.json
export UNSTANDARD_SMOKE_EVIDENCE_PATH=./tmp/smoke-proof.json
export UNSTANDARD_READINESS_EVIDENCE_OUT=./tmp/readiness-proof.json
export UNSTANDARD_EXPECTED_PREVIEW_HOSTNAME=<exact-preview-hostname>.vercel.app
npm run readiness:evidence:build

export UNSTANDARD_READINESS_EVIDENCE_PATH=./tmp/readiness-proof.json
npm run readiness:alpha
```

## Required deployed HTTP cases (must all PASS)

- `anonymous_denied`
- `user_a_login`, `user_b_login`
- `user_a_session`, `user_b_session`
- `user_a_owns_session`, `user_b_owns_session`
- `forged_reporter_id_rejected`
- `self_report_rejected`
- `duplicate_open_report_is_idempotent`
- `session_response_redacted`
- `logout_invalidates_session`
- `cleared_cookie_denied`
- `revoked_session_rejected`

## Hostname restrictions

Evidence `previewHostname` must be a **bare hostname** (not a secret-bearing URL):

- must end in `.vercel.app`
- must not be `localhost` / `*.localhost`
- must not be Production: `unstandard-m9qj.vercel.app`
- must not be main alias: `unstandard-m9qj-git-main-unstandard.vercel.app`
- when building combined evidence, must exactly equal `UNSTANDARD_EXPECTED_PREVIEW_HOSTNAME`

Hostname equality alone does **not** cryptographically prove which commit is deployed.
Operators must verify Vercel deployment metadata (project `unstandard-m9qj`, Preview target, commit SHA) separately.

## Artifact provenance notes

- Smoke/integration `gitSha` = local runner checkout (`git rev-parse HEAD`)
- Not a signed remote-deployment attestation
- Freshness window: 24 hours
- Accepted clock skew: 5 minutes into the future
- `contentDigest` on combined readiness: identifies serialized content only — **not** a signature, not tamper-proof, not independent attestation

## Report contract

- Canonical `targetType` values: `profile`, `answer`, `message` (lowercase)
- Duplicate open report by same actor/target: HTTP `200`, same id, no second row

Output redacts emails, passwords, cookies, tokens, and full IDs.
Artifacts never store credentials, cookies, bypass secrets, or database URLs.

Exit codes: `0` PASS · `1` FAIL · `2` BLOCKED_EXTERNAL
