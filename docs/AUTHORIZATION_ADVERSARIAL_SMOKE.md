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
| Deployed Preview HTTP smoke | `npm run smoke:authorization` | A/B session, identity mapping, bidirectional DB unlock, and report HTTP boundaries on Preview |
| Combined readiness | `npm run readiness:evidence:build` then `npm run readiness:alpha` | Both source artifacts PASS, matching SHA/checksum/host/freshness |

No manually authored PASS JSON is trusted. Artifacts are machine-generated.

## Session proofs (three distinct cases)

| Case | What it proves |
|------|----------------|
| `logout_invalidates_session` | Sign-in → session 200 → real logout → post-logout jar → session 401 |
| `cleared_cookie_denied` | Sign-in → clear **local** CookieJar only (no logout) → session 401 (anonymous / cookieless) |
| `revoked_session_rejected` | Sign-in → clone stale pre-logout CookieJar → logout on live jar → replay stale jar → session 401 |

Do not call a locally cleared cookie “revoked”. Only the stale pre-logout replay case may be named `revoked_session_rejected`.

## Database-runtime private-profile proof

`GET /api/profile/[id]/private`:

- accepts canonical `profiles.id` UUIDs in database runtime
- authorizes from `unlocks(viewer_user_id, profile_id)`
- proves A→B and B→A independently
- ignores forged legacy unlock cookies in database runtime

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
export SMOKE_DEPLOYMENT_GIT_SHA=<full-subject-sha>
export SMOKE_DEPLOYMENT_ID=<dpl-id>
export SMOKE_DATABASE_FINGERPRINT_SHA256=<sha256-of-safe-fingerprint>
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

## Required deployed HTTP cases (39; must all PASS)

The executable source of truth is `REQUIRED_HTTP_SMOKE_CASES`. The cases are
listed explicitly so a shortened narrative cannot hide a missing proof:

- anonymous/privacy: `anonymous_denied`, `anonymous_message_denied`,
  `waitlist_join_state_delete`
- login/session identity: `user_a_login`, `user_b_login`, `user_a_session`,
  `user_b_session`, `user_a_owns_session`, `user_b_owns_session`,
  `credential_profile_mapping_verified`
- report boundary: `forged_reporter_id_rejected`, `self_report_rejected`,
  `duplicate_open_report_is_idempotent`
- session privacy/revocation: `session_response_redacted`,
  `session_response_no_store`, `logout_invalidates_session`,
  `cleared_cookie_denied`, `revoked_session_rejected`
- initial relationship: `initial_unlock_pair_state_clean`,
  `a_to_b_private_before_unlock_forbidden`
- A→B unlock/private profile: `a_to_b_unlock_pass`,
  `a_to_b_unlock_status_true`, `a_to_b_unlock_row_exactly_one`,
  `a_to_b_private_after_unlock_ok`
- persisted messaging: `a_to_b_message_persisted`,
  `b_reads_a_to_b_message`, `message_response_no_store`
- idempotency/isolation: `duplicate_unlock_idempotent`,
  `b_does_not_inherit_a_to_b_permission`,
  `b_to_a_private_before_unlock_forbidden`,
  `forged_unlock_cookie_no_authority`
- B→A unlock/private profile: `b_to_a_unlock_pass`,
  `b_to_a_unlock_status_true`, `b_to_a_unlock_row_exactly_one`,
  `b_to_a_private_after_unlock_ok`
- final privacy/isolation: `bidirectional_viewer_isolation`,
  `private_response_no_store`
- block boundary: `block_create_idempotent`, `post_block_message_denied`

The waitlist case uses a unique synthetic address, verifies join and same-browser
capability deletion, and must leave the final state unjoined. The messaging
cases prove database persistence, recipient visibility, and private/no-store
HTTP caching; they do not claim notifications or a full inbox product.

The block cases run after the bidirectional unlock/messaging proofs. They require
the first `POST /api/blocks` to return `201`, `blocked=true`, `inserted=true`,
and the repeat to return `200`, `blocked=true`, `inserted=false`. Both responses
must be private/no-store. After blocking, conversation GET and message POST must
both return `403` with `code=BLOCKED` and private/no-store headers. Operator
fixture cleanup must remove the synthetic block before another smoke run.

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

- `subjectGitSha` = code SHA under test
- Smoke `runnerGitSha` and `deploymentGitSha` must equal `subjectGitSha`
- `evidenceCommitSha`, when a historical artifact is committed, is separate from `subjectGitSha`
- Live smoke artifacts stay outside the PR code branch to avoid self-referential SHA chasing
- Freshness window: 24 hours
- Accepted clock skew: 5 minutes into the future
- `contentDigest` on combined readiness: identifies serialized content only — **not** a signature, not tamper-proof, not independent attestation

## Report contract

- Canonical `targetType` values: `profile`, `answer`, `message` (lowercase)
- Duplicate open report by same actor/target: HTTP `200`, same id, no second row

Output redacts emails, passwords, cookies, tokens, and full IDs.
Artifacts never store credentials, cookies, bypass secrets, or database URLs.

Exit codes: `0` PASS · `1` FAIL · `2` BLOCKED_EXTERNAL

## Existing issued session mode (named Sandbox RC only)

When controlled members have already signed in but their passwords are unavailable,
set SMOKE_SESSION_INPUT_FILE to an absolute private 0600 JSON file containing
baseUrl, profileAId, profileBId, tokensA (at least one existing session),
tokensB (at least one distinct existing session), and operatorToken. Never commit or log it.
Use only server-issued, unexpired sessions of the authorized test members read
from the verified non-default RC DB. Do not INSERT sessions or reconstruct
identity eligibility. Member A/B labels may be assigned to the existing members
according to available sessions; account roles/balance/profile ownership do not change.

The operator signs in normally, then the named RC session-import endpoint validates
each existing token through Better Auth and proves expected profile ownership.
It returns a normal Secure HttpOnly session cookie, with at most 15-minute cookie
TTL and no increase to the original DB session expiry. The normal deployed member
API validates it again. Operator cookies are not included in member requests.
The endpoint is restricted to Preview/database/test-or-staging/Sandbox and the
named RC DB, and stops working at its Oct12 expiration. It never creates a session.
Wrong environment, anonymous operator, different origin, invalid/revoked/expired
token, or wrong profile is denied. No general bearer plugin is enabled.

Artifacts record authenticationMode=existing_issued_sessions. In this mode the
user_a_login/user_b_login cases prove existing-session admission plus ordinary
member session validation; they do NOT prove a fresh email/password sign-in.
Password endpoint/Auth regression evidence must retain its original provenance.
All 39 authorization assertions, genuine ownership, initial pair cleanliness,
bidirectional unlock, persistence, report/block and session revocation are unchanged.
After evidence, remove local input files and use supported logout/delete cleanup.
Do not label this mode as a new password-login test.

Existing-session revocation uses separate local-clear and stale-pre-logout jars.
The normal logout and stale replay share a real server logout, while each result
is independently asserted. This avoids requiring three extra password logins.
Console output includes every actual case result on both PASS and FAIL.
