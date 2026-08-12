# Closed-alpha operations closure handoff — 2026-08-11

> **SUPERSEDED 2026-08-12:** preserved as dated evidence. The current handoff
> is `HANDOFF_20260812_FOUNDER_ALPHA_STAGE1.md`; do not reuse this document's
> 30-seat/v3 attestation as launch authority.

## Executive verdict

| Decision surface | Verdict | Evidence |
|---|---|---|
| Previously merged P0 code | `PASS` | `main` and Production remain on merge SHA `2cc3e88a12db316e4a0a5c94981de297e0420328`; this work does not reopen that decision. |
| Dependency security cleanup | `PASS` | Production-only and full-tree npm audit gates report 0 vulnerabilities; the exact implementation Preview reproduced `found 0 vulnerabilities`. |
| Closed-alpha blocker implementation | `PASS` | DB-backed rate limits, authenticated self-deletion, support queue, privacy notice, v2 operational attestation, and Production readiness evidence are implemented and tested. |
| Isolated Neon drills | `PASS` | Account-deletion cascade, parent reset recovery, fresh 0000→0004 migration application, and both limiter update shapes passed on disposable child branches that were then deleted. |
| GitHub/Preview validation | `PASS` | PR head `6ff374049582f075ff810d8de3f09a5639bf6c34`, tree `d59a0e315d081c8d1365226bfd7a607d910038b8`, CI #124, Rebuild CI #70, and Vercel Preview build all passed. |
| Production Neon safety mode | `EXCEPTION_AUTHORIZED / IMPLEMENTED` | Project `raspy-fog-00907976`, branch `br-bitter-wave-ajs8dy0u` remains truthfully `protected=false`. The founder authorized the time-bounded `free_plan_closed_alpha_exception_v1`; attestation v3 enforces exact IDs, 30-user cap, expiry, disposable migration/restore evidence, destructive-operation prohibition, and per-change approval. |
| Overall closed-alpha launch | `IN_PROGRESS` | The paid-plan blocker is removed without falsifying branch protection. Production migration, merge, deployment, fresh runtime evidence, and final attestation still must pass in order. |

Previous stop reason, now superseded by the approved exception:

```text
BLOCKED_EXTERNAL_NEON_PAID_PLAN_REQUIRED (SUPERSEDED)
```

At this checkpoint no Production database write, migration, seed, PR merge,
Production deployment, alias change, or completed attestation has yet been
performed. Subsequent sections are updated again after execution.

## Published review surface

- Draft PR: <https://github.com/seonghyeonist/unstandard/pull/67>
- Branch: `agent/closed-alpha-operational-readiness-20260811`
- Exact implementation PR head: `6ff374049582f075ff810d8de3f09a5639bf6c34`
- Exact implementation Git tree: `d59a0e315d081c8d1365226bfd7a607d910038b8`
- GitHub CI: run #124 — success
- GitHub Rebuild CI: run #70 — success
- Preview deployment: `dpl_Crr3NiAagLCYy933rSc4Qg6A9WQQ`
- Preview URL: <https://unstandard-m9qj-2y1ir29ns-unstandard.vercel.app>

The Preview was created from 197 tracked runtime/build files belonging to the
validated implementation tree. Vercel does not expose Git metadata for this
files-API deployment, so it is build/UI evidence only and is not accepted as an
exact-SHA Production release artifact.

## What was implemented

### Database-backed abuse controls

- Better Auth uses the database limiter adapter with an `id` primary key and a
  unique `key`, matching Better Auth 1.6.23's update contract.
- Invite claims, onboarding answers, unlock attempts, reports, support requests,
  sign-in/sign-up, and account deletion have closed-alpha-v1 limits.
- Subjects are HMAC-pseudonymized; storage failure is fail-closed `503` and
  over-limit responses are `429` with `Retry-After`.

### Self-service account deletion

- Settings requires the current password and exact confirmation text before
  Better Auth deletes the user.
- Cascades and the deletion trigger remove sessions, accounts, profiles,
  private profile data, answers/evaluations, unlock data, blocks, submitted and
  targeted reports, support requests, invite links, and verification values in
  the same transaction.
- No real user was used for the drill.

### Support, moderation, and privacy

- Authenticated in-app support requests are stored in `support_requests`.
- Founder · seonghyeonist is the documented initial incident, support,
  moderation, and privacy owner with a 240-minute response target.
- `/privacy` discloses the actually implemented collection, storage, retention,
  deletion, Vercel/Neon processing, and in-app rights-request channel.

### Fail-closed release evidence

- The operator-only Production endpoint checks runtime mode, exact release SHA,
  required secrets, canonical origins, redacted Neon host fingerprint, exact
  five-entry migration ledger, 17 required tables, `alpha.closed`, and the
  active unlock question without writing data.
- The v3 attestation requires real project/branch IDs and either a protected
  paid-plan branch or the narrow Free-plan exception, plus restore drill
  evidence, deletion and support references, privacy URL, rollback deployment
  ID, assigned owners, policy version, SHA match, freshness, and a digest-bound
  output.
- Placeholders and incomplete evidence fail closed.

## Strict verification record

| Check | Result |
|---|---|
| Local full gate before publish | `PASS` — lint, TypeScript, 232 tests, Production build, audit 0 |
| GitHub CI #124 | `PASS` on `6ff3740…` |
| GitHub Rebuild CI #70 | `PASS` on `6ff3740…` |
| Local vs GitHub implementation tree | `PASS` — both `d59a0e315d081c8d1365226bfd7a607d910038b8` |
| Vercel Preview install | `PASS` — 425 packages installed, 426 audited, 0 vulnerabilities |
| Vercel Preview build | `PASS` — compile, TypeScript, 19/19 page generation, new routes present |
| Preview landing page | `PASS` — authenticated Preview browser session rendered landing/login |
| Preview `/privacy` | `PASS` — HTTP 200 and rendered current notice |
| Preview unauthenticated readiness | `PASS` — Vercel runtime log recorded `GET /api/operations/readiness 404` |
| Preview runtime error scan | `PASS` — no runtime error clusters in the observed 30-minute window |
| Disposable deletion drill | `PASS` — seven dependent fixtures created; user deletion left zero dependent rows |
| Disposable restore drill | `PASS` — mutated `alpha.closed` returned to parent state; test schema/user residue zero |
| Fresh migration drill | `PASS` — migrations 0000 through 0004 applied in order on a fresh child branch |
| Limiter database contract | `PASS` — Better Auth-style and application-style atomic 1→2 updates |
| Production branch identity | `PASS` — exact project/branch identified |
| Production database safety | `PASS IN CODE / PENDING FINAL ATTESTATION` — confirmed `protected=false`; v3 exception requires 30-user cap and every compensating control |

## Neon evidence and boundaries

Production candidate:

- project: `raspy-fog-00907976` (`unstandard-alpha-preview-app-db`)
- branch: `br-bitter-wave-ajs8dy0u` (`main`)
- root/default: `true`
- region: AWS `us-east-2`
- history retention: 6 hours
- protected: `false`

The child `br-holy-sunset-ajo5h07n`
(`disposable-unlock-integration-20260805`) contains integration/A/B test data
and is explicitly excluded from Production.

Disposable drills already cleaned up:

- `br-silent-grass-ajbykag9` — deletion + parent-reset recovery drill; deleted
- `br-fragrant-sunset-ajf5nddl` — fresh migration + limiter contract drill; deleted

The Free-plan Console exposes `Set as protected` as a disabled action. Neon's
current documentation states that protected branches are available on paid
plans. The founder elected to accept this residual risk for a maximum 30-person
closed alpha. The gate does not pretend protection exists: it requires plan
`Free`, `protected=false`, exact pinned IDs, expiry, disposable drill evidence,
destructive-operation prohibition, and per-change approval.

## Operational gate status

| Attestation item | Current evidence | Status before Production |
|---|---|---|
| Incident owner | Founder · seonghyeonist; 240-minute target documented | implemented; operator attestation still required |
| Support channel | in-app queue and endpoint implemented | Production migration + test ticket required |
| Rollback | previous READY Production deployment exists | exact rollback candidate/review must be recorded after final release SHA is known |
| Restore | isolated Neon parent-reset drill passed | evidence available; must be copied into operator-local attestation |
| Privacy notice | Preview `/privacy` returns 200 | Production publication required |
| Account deletion | isolated transactional deletion drill passed | evidence available; Production UI/API smoke still required |
| Moderation owner | Founder · seonghyeonist and response rules documented | operator attestation still required |
| Rate-limit policy | closed-alpha-v1 implemented and DB-tested | operator approval still required |
| Production database | exact branch identified; v3 exception implemented | final operator-local exception evidence required |

No checked-in example was flipped to `true`, and no final launch artifact was
created.

## Exact continuation procedure under the Free-plan exception

1. Re-run the pre-migration read-only ledger/table/count baseline on
   `br-bitter-wave-ajs8dy0u`.
2. Record the v3 exception with exact IDs, maximum cohort 30, expiry no more
   than 30 days away, and the already-passed disposable migration/restore
   references.
3. Apply only migrations 0001, 0002, 0003, and 0004 to that branch using the explicit
   migration guard. Do not seed. Verify the five exact migration hashes, 17
   tables, limiter keys, deletion trigger, and unchanged user/profile counts.
4. Create and receive one opaque support test ticket and run one disposable
   account-deletion test. Do not use a real user.
5. Re-run final PR checks. Merge PR #67 only with its exact expected head SHA.
6. Confirm the Vercel Git-linked Production deployment maps to the resulting
   merge SHA and is READY. Verify required Production env names without printing
   secret values.
7. Run `operations:production:verify` against the canonical Production host and
   exact redacted DB fingerprint.
8. Complete an operator-local v3 attestation with the real evidence above and
   run `operations:closed-alpha:gate`.
9. Launch only if both fresh artifacts PASS. Start below the attested cohort
   cap and inspect Vercel errors/5xx after the first user and every invite batch.

## Do not infer

- CI PASS is not Production readiness.
- The files-API Preview is not exact-SHA Production proof.
- A default/root Neon branch is not protected merely because it cannot be
  deleted like a normal child branch.
- The isolated drills do not apply migrations to Production.
- A Preview privacy page is not a published Production notice.
- Documented owners and policies are not a completed operator attestation.

The detailed procedure remains in
`docs/CLOSED_ALPHA_OPERATIONS_RUNBOOK.md`.
