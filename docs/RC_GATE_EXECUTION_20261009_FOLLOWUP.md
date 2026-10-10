# Closed Alpha execution follow-up — 2026-10-09

Runtime subject: fb5d4a5658e21532fd70468b23c4453200a4ca5b,
dpl_HXYsNYPCkeeErC2THN7wfDLuZ4yH. This change adds tests and documentation only.
It does not certify a subsequently deployed SHA by inheritance.

The latest PR92/Issue93 authority was re-read before work. PR remains draft,
open and unmerged. RC branch br-still-bar-ajx7wl9d is non-default/non-primary;
its recorded expiration is 2026-10-12T23:59:00Z. Production and Live were not changed.

## Executed and restored

- Deployment-only protection override opened at 08:42:19 UTC on the explicitly
  approved immutable host and revoked at 08:45:07 UTC (under three minutes).
- PR92 Sandbox RC destination changed to that host, provider tester sent an
  Approved sample, and the original branch-alias destination was restored after
  failure. PR80 destination was not changed.
- Unsigned POST reached the application: 401 / Invalid webhook / private no-store.
  Operator session: 200 authorized=false. Debug fingerprint: 404 / no-store.
- Provider sample at 08:44:25 UTC: 401, application log SIGNATURE_INVALID.
  Sample preview contains historical timestamps; log does not discriminate
  freshness/schema/key mismatch. No bound completion, replay or purge PASS claimed.
- Protected anonymous POST after restoration: platform 401. The pre-existing
  shareable link on this exact deployment was revoked; protectionBypass readback {}.
- New deterministic retry tests: canonical transient failure preserves durable
  completion; purge 503 and 202 retain the outbox until explicit 200 confirmation;
  repeated reconciliation adds no duplicate verification/purge effects.
- Disposable DB persistence suite: 16/16 PASS, including canonical failure,
  verified_unpurged eligibility denial, successful purge and idempotent replay.
  Synthetic provider and database fixtures are not actual provider evidence.
- npm run check: lint/typecheck/398 unit tests/build PASS. Boundary/legacy guards PASS.
- Final RC counts: users2 / identity_verifications2 / legal_acceptances2 /
  CLOSED support1 / support_events1 / purge_queue0 / active delegated sessions0.
  Disposable test DB users0 / identities0 / purge_queue0.

## Execution gate plan

| Task | PASS condition | Current result | Dependency / restoration |
|---|---|---|---|
| A Provider | App-issued bound Sandbox completion, valid signature/canonical proof, provider replay, explicit erasure and absence | BLOCKED; actual sample FAIL401; deterministic retry PASS | Normal new test signup and bound session; max-one-hour approved-host exception; restore URL on failure and revoke exception immediately |
| B Members | Final-SHA 39-case, fresh password login/logout/stale-cookie rejection, own-account deletion and provider purge | NOT_RUN on current runtime | Controlled new A/B accounts; no existing-member resets or hash edits; delete only generated fixtures |
| C Access retirement | Old operator/debug/share paths denied, latest disabled, delegated active0 | Partial: latest disabled and exact current share revoked; old immutable retirement BLOCKED | Inventory 61 RC-branch deployments; old 62f12f1 deployment has no aliases. Preserve non-identifying evidence/rollback before any explicitly identified deletion |
| D Operations | Exact v4 crosswalk, mature observations and approved contract fields | Crosswalk prepared; metrics INSUFFICIENT_DATA | Do not invent founder approvals, quality metric or Production evidence |

## Operations-v4 crosswalk

| Requirement | Code/evidence | Disposition and limit / next action |
|---|---|---|
| Incident/support/moderation/privacy owners | CLOSED_ALPHA_OPERATIONS_RUNBOOK: Founder seonghyeonist, 240-minute rule | PASS documentation scope; founder availability attestation remains required for launch |
| Support response | Private operator replies, member inbox, audit; Issue93 prior actual RC ticket | PASS prior loopback→RC/member-screen scope; deployed operator assignment/reply NOT_RUN; historical SLA breach preserved |
| Rollback | Runbook and immutable deployment inventory | Procedure exists; no Production rollback execution claimed; preserve operating rollback while retiring only RC tests |
| Restore drill | Prior authority and isolated snapshot restore | PASS inherited isolated scope only; obtain fresh Production-specific evidence if launch requires it |
| Notice/consent | identity notice/consent v2 and prior contract evidence | Carry forward latest authority; historical September18/21 no-signature notes are superseded, not reopened |
| Account deletion | Prior isolated auth lifecycle; purge outbox; new retry tests | PASS isolated implementation; actual provider-bound deployed account deletion NOT_RUN |
| Rate limits | Current limiter, auth and authorization checks | Implementation present; actual policy approval is not inferred from tests |
| DB safety | Named non-default RC and disposable databases | PASS execution scope; Production safety/Free exception approvals remain separate |
| Measurement | alpha-stage1-kpi-v1; actual RC snapshot 08:45:55 UTC | PASS extraction; 2/50 COLLECTING, INSUFFICIENT_DATA; not recruitment success |
| Fast-track Mean Depth | Spec v4.2 threshold .50; founder execution plan WP3; mock-local-heuristic-v0.0 | BLOCKED contract definition: exact numerator/denominator/window/population/sample required. Keep NOT_IMPLEMENTED; Local AI OFF |
| Supply balance | Consent-based opaque A/B metrics and runbook | INSUFFICIENT_DATA; no inferred protected traits or invented policy approval |
| Domain | Current verified Vercel mapping; DOMAIN_AUDIT_20260821 | Acquisition UNKNOWN; mapping does not prove purchase/ownership. Trademark screening not clearance; handles and spelling test remain unproven |
| Monetization | Current closed-alpha plan | Disabled scope preserved; no purchase, contract, paid recruitment or monetization activation |

No launch artifact with ok:true is created. Technical ready NO; operational
evidence incomplete; actual launch approval NOT_PERFORMED. Human review remains
founder-waived NOT_PERFORMED. Password reset is excluded.

## Concrete remaining execution dependencies

The current runtime has empty branch operator/debug overrides. The authenticated
environment read does not disclose the sensitive global invite pepper. Therefore
normal controlled invite issuance cannot be performed through the available
disabled operator endpoint or by manufacturing a matching local capability.
No verified RC rows, fake ownership proofs, real-member password changes or
parent-session modifications were used to evade this dependency.

Prepare a branch-only temporary operator credential to issue new controlled
invites through the normal app flow, then revoke it. A redeploy yields a new
immutable host: supplier protection approval is restricted to the old named
host and cannot be silently transferred. Record exact new deployment/host before
requesting the narrow replacement scope. Final membership checks must target
the deployment after temporary environment cleanup.

Old immutable deployment deletion is not offered by the available Vercel
connector. The exact October7 deployment is
dpl_CDWJEaAkTigPFtQ32mLTkaD1rN2V (62f12f1f1bd415ddad79782eaf4bab98f32e507f),
no aliases observed. Do not delete the whole 61-deployment inventory or shared
Production credentials. Prepare evidence export and rollback impact review,
then use the approved exact-resource retirement route; UI permanent deletion
requires action-time confirmation under browser policy.
