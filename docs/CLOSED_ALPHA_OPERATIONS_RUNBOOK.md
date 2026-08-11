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
- all 17 required application tables
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
| Production database | Exact Neon project/branch identifiers plus either `protected=true` or the time-bounded Free-plan compensating-control exception |

The v3 attestation also requires structured evidence. Placeholders including
`TODO`, `TBD`, `REPLACE`, and `unknown` fail closed. An unprotected database
passes only through `free_plan_closed_alpha_exception_v1`; merely setting
`protected=false` never passes. The launch artifact includes a digest of the
full evidence object.

## Assigned closed-alpha owners and response rule

For the initial cohort, the named owner for incidents, support, moderation,
and privacy requests is **Founder · seonghyeonist**. The response target is
240 minutes. This is a single-owner alpha arrangement, so the owner must pause
new invites whenever that response target cannot be met.

- Safety, threats, harassment, impersonation, or exposed private data: pause
  the affected account/content path immediately, retain the minimum incident
  reference, and review before the next invite batch.
- Other reports and support tickets: acknowledge and triage within 240 minutes.
- The application creates an immediate self-block and an `OPEN` report; it
  never auto-sanctions a reported user. The owner records the disposition by
  changing the report/ticket status only after review.
- The supported channel is `Settings → 지원·안전 요청`. A test ticket UUID
  is mandatory attestation evidence.

Operator queue (do not select message bodies during routine health checks):

```sql
SELECT id, category, status, created_at
FROM support_requests
WHERE status IN ('OPEN', 'IN_PROGRESS')
ORDER BY created_at ASC;
```

## Closed-alpha-v1 rate limits

State is stored atomically in Neon, not function memory. Subjects used by
application endpoints are HMAC-pseudonymized. Vercel's trusted
`x-forwarded-for` value is used for unauthenticated invite claims.

| Surface | Limit | Window | Subject |
|---|---:|---:|---|
| Better Auth default | 100 | 10 seconds | IP + path |
| Sign in / sign up | 5 | 60 seconds | IP + path |
| Account deletion | 3 | 1 hour | IP + path |
| Invite claim | 10 | 15 minutes | IP |
| Onboarding answer | 10 | 10 minutes | authenticated user |
| Unlock answer | 20 | 10 minutes | authenticated user |
| Report | 5 | 1 hour | authenticated user |
| Support request | 3 | 24 hours | authenticated user |

Over-limit responses are `429` with `Retry-After`. A limiter storage error is
fail-closed `503`. Rows older than two days are pruned opportunistically.

## Account deletion

The user opens Settings, enters the current password and the exact confirmation
text `계정 삭제`, then submits. Better Auth verifies the credential and deletes
the user. Foreign-key cascades remove sessions, accounts, profiles, private
profiles, answers/evaluations, unlock data, blocks, reports submitted by the
user, and support tickets.

A database `BEFORE DELETE` trigger removes residual target reports, consumed
invite/email links, and verification values in the same transaction. Verification
must create a disposable test user with dependent rows, delete that user, and
prove zero remaining rows by opaque test reference only. Never use a real user
for the drill.

The public notice is `/privacy`. Active data is removed immediately; the
current Neon restore history window is six hours, after which recoverable
history expires.

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
3. Start at or below the attested cohort cap. The approved Free-plan exception
   cap is 30; issue invitations in smaller batches.
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

- Production must be an explicitly identified root branch before launch. A
  Preview/default branch is not accepted by naming inference. Require either a
  protected paid-plan branch or the v3 Free-plan exception below.
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
- [Neon protected branches](https://neon.com/docs/guides/protected-branches)
- [Neon branch management and plan boundary](https://neon.com/docs/manage/branches)

## Production database identity (2026-08-11)

- Project: `raspy-fog-00907976` (`unstandard-alpha-preview-app-db`)
- Production source branch: `br-bitter-wave-ajs8dy0u` (`main`)
- Region: AWS `us-east-2`
- History retention: 6 hours
- Organization plan observed in Console: Free
- Protection observed through Console and Neon metadata: `protected=false`
- The `disposable-unlock-integration-20260805` child contains integration/A/B
  data and is explicitly excluded from Production.

Identification is not protection. Protected branches are a Neon paid-plan
feature and the observed Free plan cannot enable the control. Do not record a
compensating `protected=true` value.

## Neon Free-plan closed-alpha exception v1

The founder accepted the residual risk of using the identified unprotected
Free-plan branch for the initial closed alpha. This exception is narrower than
normal Production approval and passes only when all of these are true:

- attestation `artifactVersion=3`, plan `Free`, `protected=false`, and safety
  mode `free_plan_closed_alpha_exception_v1`
- exact project `raspy-fog-00907976` and branch
  `br-bitter-wave-ajs8dy0u` repeated in the exception evidence
- review no older than seven days; exception expiry after review and no more
  than 30 days later
- initial cohort no larger than 30; invitations pause when compute/storage
  quota, recovery evidence, error rate, or operator response degrades
- no Production branch reset/delete, `DROP TABLE`, or `TRUNCATE`; each
  Production write or migration requires explicit human approval. Canonical
  migration 0004's reviewed `DROP CONSTRAINT` + replacement PK/UNIQUE is
  permitted only inside the same migration transaction
- migration tested first on a disposable child branch; restore drill reference
  and exact migration hashes retained
- no seed during Production migration, and user/profile counts checked before
  and after

Current observed Free-plan capacity evidence on 2026-08-11 is approximately
30.5 MiB logical storage, 799 compute seconds, and 3,128 active seconds on the
Production candidate. These are observations, not a future capacity guarantee.
Neon Free currently provides 0.5 GB storage and 100 CU-hours per project/month.

The same read-only baseline has five users, five profiles, twelve invites,
fourteen public tables, and only migration `0000` in the canonical ledger.
Therefore this release must apply `0001` through `0004` in order; the older
handoff instruction that started at `0002` is superseded by this observed
ledger, not trusted from memory.

Operational rollout is 30 invited users maximum, with the first batch kept
smaller and an initial simultaneous-active target of 10–20 users. The database
and application do not otherwise impose a user-count hard cap, so invite
issuance is the enforceable operator boundary for this alpha.

Upgrade review is mandatory before exceeding 30 users, before storing payment
data, after a quota/recovery incident, or when the exception expires. On a paid
plan, switch the attestation to `protected_branch`, protect only the exact
branch above, and re-read `protected=true` before the next release.
