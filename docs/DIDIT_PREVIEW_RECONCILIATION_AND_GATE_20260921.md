# Didit Preview reconciliation and gate record — 2026-09-21

Status: **BLOCKED_EVIDENCE — fail closed**

This is the current engineering record for PR #80. It supersedes older
webhook implementation descriptions, but does not supersede their historical
account observations. It is not legal advice, DPA acceptance evidence, or
approval to collect live identity data.

## Scope and safety boundary

- PR #80 remains open, draft, and unmerged. Production Vercel, `main`,
  production environment variables/domains, and the default Neon branch are
  out of scope.
- The Didit console was inspected in **Sandbox/test mode** only. No live
  application setting was changed, no actual identity was submitted, and no
  secret or provider/session identifier is recorded in this repository.
- `IDENTITY_PROVIDER_NOTICE_READY=false` remains mandatory. There is no
  environment override for that gate.

## Current Sandbox account observations

The connected Didit organization has a Sandbox application and existing
Sandbox API-key material. The following facts were read from the account UI:

- the application is in test mode;
- session retention is set to one month;
- the biometric-template setting is `delete with session`;
- a Preview-only destination named `PR80 Preview` is active for two events at
  the `/api/identity/webhook` route on the PR branch alias;
- delivery history contains no completed delivery yet.

Those observations are intentionally insufficient to claim that the API key,
workflow ID, webhook secret, identity flag, or app URL are bound correctly in
Vercel Preview. Their values and scopes were not exposed by the connected
Vercel surface. No setting was relaxed to bypass the legal notice gate.

## Webhook and orphan-session closure

Didit documents a five-second webhook response budget. The endpoint now does
only signature/workflow/vendor binding, a local lookup, and an atomic durable
schedule before replying `202`; it never waits for a canonical provider
decision or provider deletion in that delivery window. A database failure
returns `503`, so an untracked job is never acknowledged.

`npm run identity:reconcile` is the bounded operator reconciliation command.
It refuses to execute unless the normal provider readiness gate is available,
accepts only `IDENTITY_RECONCILE_LIMIT=1..50`, and writes count-only output.
For each scheduled row it fetches the canonical decision server-side and
preserves the existing `pending -> verified_unpurged -> verified` ordering.
It also revisits expired pending rows with a bound provider session and every
`verified_unpurged` row, so an abandoned browser flow or a local failure after
provider completion is retried for deletion without requiring another browser
callback. Transient provider/purge failures remain scheduled; conclusive
rejection/expiry is purged before the pending local row is removed.

The implementation stores only opaque local/provider references, status,
timestamps, consent/notice versions, and purge evidence. It does not persist
raw Didit decisions, documents, media, biometrics, or webhook envelopes.
The adapter treats a documented already-absent delete response as an idempotent
purge outcome for an already server-bound session reference.

## Data-map facts suitable for notice drafting

The current engineering path is:

1. The Didit hosted flow processes the provider-required document, liveness,
   face-match, and device/IP material under the still-unproven account
   workflow and contract.
2. The Preview server receives a signed webhook envelope, then fetches the
   canonical decision server-side. It derives only the approval checks and
   age-policy result required by the adapter.
3. Vercel writes the local opaque state above to Neon. The connected Neon
   project is in AWS US East (Ohio); the previous exact-head Preview function
   inspection placed the server function in Washington, D.C. These are
   engineering observations, not a complete account-bound processing-region
   statement.

The Korean notice must not call Didit active, state a deletion guarantee, or
state a region/subprocessor/transfer fact until the controller-approved,
account-bound evidence package exists.

## Current L1–L10 disposition

| Gate | Disposition | Concrete evidence |
| --- | --- | --- |
| L1 Contract/roles | BLOCKED_EVIDENCE | Console legal surfaces did not expose UNSTANDARD's accepted terms/DPA version, entity, or acceptance time. |
| L2 Region/subprocessors | BLOCKED_EVIDENCE | No account-bound proof of processing/biometric region, support access, binding subprocessors, or transfer mechanism was available. |
| L3 Data minimization | BLOCKED | Current Sandbox Returned Data/document-method settings have not been evidenced as the approved minimum scope. |
| L4 Retention/erasure | CONDITIONAL_PASS | Sandbox shows one-month retention and delete-with-session templates; code has purge-before-verified and retry cleanup, but provider deletion E2E is still absent. |
| L5 Korean notice | BLOCKED | Current notice intentionally says Didit is inactive; controller-approved final factual notice is absent. |
| L6 Workflow | BLOCKED_EVIDENCE | Sandbox workflows exist, but exact approved Korean document/age scope and Vercel Preview workflow binding are not proven. |
| L7 Webhook | CONDITIONAL_PASS | Sandbox Preview destination is active; code persists schedule before `202`, but no real delivery/retry record exists. |
| L8 Preview environment | BLOCKED_EVIDENCE | The connected Vercel surface did not reveal presence/scope/branch binding for required server-only values. |
| L9 Reachability | BLOCKED | No current exact-head callback delivery or webhook runtime probe has been proven. |
| L10 Synthetic identity | BLOCKED | No controller-approved vendor/synthetic test subject and consent fixture is available. |

## Gate state

```text
DIDIT_CONFIG=BLOCKED_LEGAL_NOTICE
DIDIT_E2E=NOT_RUN
DIDIT_LIVE_COLLECTION=BLOCKED
IDENTITY_PROVIDER_NOTICE_READY=false
CLOSED_ALPHA_READY=NO
```

## Sources

- Didit [Webhooks](https://docs.didit.me/integration/webhooks)
- Didit [Delete Session](https://docs.didit.me/sessions-api/delete-session)
- Didit [Security and compliance](https://docs.didit.me/getting-started/security-compliance)
- The active authentication decision remains
  `docs/CLOSED_ALPHA_AUTH_PATH_DECISION_20260910.md`: OAuth is retired;
  invite → email ownership verification → password is the only Closed Alpha
  registration path, with email/password login and email-based recovery.
