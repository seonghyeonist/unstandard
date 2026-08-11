# Closed-alpha operations runbook

## Verdict boundary

`npm run readiness:alpha` proves the P0 integration + deployed Preview smoke
contract only. It does not authorize a closed-alpha launch.

The launch decision has two independent inputs:

1. `operations:production:verify` — fresh exact-SHA Vercel Production runtime
   and read-only Neon schema/seed evidence.
2. `operations:closed-alpha:gate` — a separate operator attestation for
   incident response, rollback, restore, privacy, deletion, moderation, abuse
   controls, support, and cohort size.

Missing either input is `NOT_READY`, not an inferred PASS.

## User story under verification

An invited user reaches the Production UI, authenticates, completes
onboarding, and uses DB-backed candidate/unlock/private-profile/report flows.
The operator can identify the exact deployed commit and database branch,
detect an early failure from structured logs, stop invitations, roll the app
back, and recover data without guessing.

## Technical Production preflight

The authenticated endpoint is:

```text
GET /api/operations/readiness
Authorization: Bearer <UNSTANDARD_DEBUG_CHECK_TOKEN>
```

Unauthenticated or incorrect credentials receive `404`. The endpoint is
read-only and returns no connection string, secret, email, user id, profile id,
or application-row count. It checks:

- Vercel `production` + Node production target
- database runtime + `DATABASE_ENV=production`
- presence of the five required server-side runtime values
- canonical HTTPS auth/app origins equal the request origin
- exact 40-hex release SHA
- Neon connectivity and a redacted hostname fingerprint
- exact Drizzle migration ledger hashes
- all 15 required application tables
- `alpha.closed.enabled=true`
- the configured closed-alpha unlock question is active

Run from an operator shell without placing secrets in command history:

```bash
export UNSTANDARD_PRODUCTION_BASE_URL=https://unstandard-m9qj.vercel.app
export UNSTANDARD_EXPECTED_PRODUCTION_GIT_SHA=<40-hex-sha>
export UNSTANDARD_EXPECTED_PRODUCTION_DB_HOST_SHA12=<approved-12-hex-fingerprint>
export UNSTANDARD_PRODUCTION_READINESS_EVIDENCE_OUT=/tmp/unstandard-production-readiness.json
# Supply UNSTANDARD_DEBUG_CHECK_TOKEN through the secret manager.
npm run operations:production:verify
```

The verifier accepts only a fresh (15-minute), exact-SHA, exact-host,
Production report whose gates all PASS. It writes with mode `0600` and refuses
to overwrite an existing artifact.

## Closed-alpha operational gate

Copy `config/closed-alpha-attestation.example.json` to an operator-local path.
Do not flip a value to `true` until it was actually checked. The checked-in
example is deliberately all false.

Required attestations:

| Gate | Evidence required |
|---|---|
| Incident owner | Named person and reachable channel |
| Support channel | Test message received and triage path recorded |
| Rollback | Previous READY Vercel deployment identified; procedure reviewed |
| Restore | Neon history-window/branch recovery drill completed on non-Production data |
| Privacy notice | Current collection/retention/deletion notice published |
| Account deletion | Real deletion or documented operator procedure verified end to end |
| Moderation | Report owner and response rule assigned |
| Rate-limit policy | Implemented limits or explicitly reviewed cohort-bound control |

Then run:

```bash
export UNSTANDARD_PRODUCTION_READINESS_EVIDENCE_PATH=/tmp/unstandard-production-readiness.json
export UNSTANDARD_CLOSED_ALPHA_ATTESTATION_PATH=/secure/operator/closed-alpha-attestation.json
export UNSTANDARD_CLOSED_ALPHA_GATE_OUT=/tmp/unstandard-closed-alpha-gate.json
npm run operations:closed-alpha:gate
```

The technical evidence must be no older than 6 hours and the operational
review no older than 7 days. Git SHAs must match. The combined output is a
digest-bound operator record, not a cryptographic signature.

## Rollout

1. Freeze the exact commit, Vercel deployment ID, canonical hostname, and
   approved Neon host fingerprint.
2. Require both gates above to PASS.
3. Start below the attested cohort cap. The example cap is 20, not an approval.
4. Issue invitations in batches; pause before the next batch if any P0 flow,
   moderation, or support gate degrades.
5. Check Vercel runtime errors and 5xx counts after the first real user and
   after each batch. A zero-error report with zero/near-zero traffic is not
   availability evidence.

## Application rollback

- Stop issuing invites first.
- Record the incident timestamp, exact deployment ID, and affected routes.
- Roll back or re-alias only to a previously verified READY deployment.
- Re-run the Production preflight against the rolled-back SHA.
- Do not run migration/seed as part of Vercel build or rollback.

## Neon recovery

- Production must be an explicitly identified, protected root branch before
  launch. A Preview/default branch is not accepted by naming inference.
- Use a pooled connection string for Vercel request workloads. Use direct
  connections for migrations and administrative tools that need session state.
- For accidental deletion, first create/query an isolated historical branch or
  use Time Travel Assist to identify the correct point.
- Prefer row-level recovery from the isolated branch when possible. Full instant
  restore overwrites the branch's data and schema and interrupts connections;
  it requires a separate human approval and incident record.
- Delete temporary recovery/test branches after evidence is captured.

Official references:

- [Neon production/staging branching](https://neon.com/branching/production-staging-workflows)
- [Neon recovery workflows](https://neon.com/branching/recovery-workflows)
- [Neon instant restore](https://neon.com/docs/introduction/branch-restore)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)

## Current known blockers (2026-08-11 baseline)

- Vercel Production is READY at merge SHA `2cc3e88a…`, but the new operations
  endpoint is not on that deployment.
- The Production deployment's Neon branch identity has not been proven.
- The observed Neon default branches are not protected.
- A Neon restore drill has not been recorded.
- User-facing account deletion is not implemented; an operator deletion
  procedure has not been proven here.
- Rate limiting/abuse policy remains open.
- A moderation owner/SLA and support channel have not been attested.
- Vercel showed no runtime error clusters in the previous 24 hours, but the
  observed request sample was only one HTTP 200, so stability is unproven.

Therefore the current overall verdict remains `CLOSED_ALPHA_NOT_READY` even if
all repository tests pass.
