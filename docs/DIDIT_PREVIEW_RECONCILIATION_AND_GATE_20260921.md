# Didit Preview reconciliation and gate record — 2026-09-21

Status: **BLOCKED_EVIDENCE — fail closed**

This is the current engineering record for PR #80. It supersedes older
webhook implementation descriptions, but does not supersede their historical
account observations. It is not legal advice, DPA acceptance evidence, or
approval to collect live identity data.

## Scope and safety boundary

- PR #80 remains open, draft, and unmerged. Production Vercel, `main`,
  production environment variables/domains, and the default Neon branch remain
  out of scope.
- The Didit console was inspected in **Sandbox/test mode** only. No live
  application setting was changed, no actual identity was submitted, and no
  secret or provider/session identifier is recorded in this repository.
- `IDENTITY_PROVIDER_NOTICE_READY=false` remains mandatory. There is no
  environment override for that gate.
- The Vercel Preview secret was corrected to be Preview-branch-only. The
  Production copy was removed; no Production identity secret is intended or
  required.

## Current Sandbox account observations

The connected Didit organization has a Sandbox application and active Sandbox
API-key material. The following facts were read from the account UI:

- the application is in test mode;
- the Free KYC workflow ID is
  `906530b5-e097-481d-aaae-21b7b5e71fbb`;
- South Korea is the only enabled country, with National ID card and Driver's
  license document methods;
- the minimum age is saved as **19** and was re-opened after saving to verify
  the persisted value;
- Returned Data has only **date of birth** selected from the 35 optional
  points; the provider-mandated status, warning, and node ID remain the only
  additional system fields;
- session retention is set to one month;
- the biometric-template setting is `delete with session`;
- a Preview-only destination named `PR80 Preview` is active for
  `status.updated` and `data.updated` at the
  `/api/identity/webhook` route on the PR branch alias;
- delivery history contains no completed delivery yet.

These settings establish a minimized Sandbox configuration, but they do not
establish controller-approved legal scope, account-bound contract/role
evidence, a real identity-provider deletion result, or permission to collect
live identity data.

## Preview environment binding

The connected Vercel project was rechecked after the Sandbox configuration
readback. For the PR branch `feat/alpha-profile-identity-20260828`, the
Preview environment shows the required server-only binding:

- `UNSTANDARD_IDENTITY_ENABLED=true`;
- the exact Sandbox `DIDIT_WORKFLOW_ID`;
- a masked `DIDIT_API_KEY`;
- `UNSTANDARD_APP_URL`;
- a masked `DIDIT_WEBHOOK_SECRET`.

The webhook secret is present only on that Preview branch. The current
Preview code still fails closed before provider processing because the
notice-ready constant remains false. No Production environment variable,
domain, deployment target, or main/default Neon branch was changed.

## Webhook and orphan-session closure

Didit documents a five-second webhook response budget. The endpoint now does
only signature/workflow/vendor binding, a local lookup, and an atomic durable
schedule before replying `202`; it never waits for a canonical provider
decision or provider deletion in that delivery window. A database failure
returns `503`, so an untracked job is never acknowledged.

The implementation accepts the documented V2 HMAC form and legacy compatibility
forms, enforces the Didit five-minute timestamp freshness window, binds the
header timestamp to the signed envelope, and uses constant-time comparison.
`npm run identity:reconcile` is the bounded operator reconciliation command.
It refuses to execute unless the normal provider readiness gate is available,
accepts only `IDENTITY_RECONCILE_LIMIT=1..50`, and writes count-only output.

For each scheduled row it fetches the canonical decision server-side and
preserves the existing `pending -> verified_unpurged -> verified` ordering.
It also revisits expired pending rows with a bound provider session and every
`verified_unpurged` row, so an abandoned browser flow or a local failure
after provider completion is retried for deletion without requiring another
browser callback. Transient provider/purge failures remain scheduled;
conclusive rejection/expiry is purged before the pending local row is removed.

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

## Exact-head post-binding verification

At the post-binding verification point, source commit
`4f09108dabf2c7612b1ac567e0f31080c88e7732` had both PR-triggered GitHub
workflows green: Rebuild CI #155 and CI #215. Vercel Preview deployment
`dpl_BNjR6smvxPejUVazrdB77KAyqXrj` reached `READY` from that exact commit
in `iad1`, on the PR branch alias.

The exact Preview alias returned `200` for `/privacy`. A `GET` to the
POST-only webhook route returned the expected `405`. Didit's provider-supplied
webhook test fixture was sent to the active `PR80 Preview` destination; the
console reported `404`, and Vercel recorded
`POST /api/identity/webhook 404` with
`identity.webhook.provider_unavailable / NOTICE_NOT_READY`. This proves
callback reachability and the intended fail-closed notice gate, not successful
identity verification or provider-data acceptance.

A new non-default Neon branch
`pr80-exact-final-20260921-4f09108` was used for the database check. The
PR's 0009–0013 migrations were applied only there. The current schema-aware
synthetic policy fixture passed, including age 19, consent withdrawal,
revision freshness, opposite-gender eligibility, block exclusion, database
constraints, and deletion cleanup; post-run counts for synthetic users,
profiles, basics, identity rows, and blocks were all zero. The primary/default
Neon branch was not changed.

## Predecessor exact-head verification snapshot — 2026-09-21

The following is retained as a historical snapshot for predecessor commit
`4355968b9ec961d00e309dcfa64e54e4c2845966`. Because this evidence file is
itself versioned on the PR branch, a later documentation commit changes the
branch HEAD. The final exact-head CI/Vercel packet is therefore maintained in
PR #80's closure body after the final deployment.

- HEAD: `4355968b9ec961d00e309dcfa64e54e4c2845966`
- Rebuild CI #157 / run `35653677691`: SUCCESS
- CI #217 / run `35653677706`: SUCCESS
- Vercel Preview deployment `dpl_HaGWojNmBtyzLnhBuNxsZyjajphH`: READY,
  Git source SHA exact, branch exact, region `iad1`, and the existing PR
  branch alias is attached.
- Direct deployment probes returned `/privacy → 200` and
  `GET /api/identity/webhook → 405` as expected for a POST-only route.
  No provider identity collection was enabled or claimed on this docs-only
  head. The earlier provider fixture's `404 NOTICE_NOT_READY` remains
  historical evidence for the preceding implementation head, not a new
  identity E2E pass.

A new disposable Neon branch
`pr80-recheck-20260921-28ca-expiring`
(`br-snowy-grass-ajz5bj7f`) was created from the untouched primary/default
branch `main` (`br-bitter-wave-ajs8dy0u`). On that branch:

- PR migrations 0009–0013 were applied and the Drizzle ledger was verified at
  14 rows with exact current migration hashes and timestamps.
- `identity_verifications` contains only opaque references, status,
  timestamps, consent/notice versions, and purge evidence; no raw identity,
  document, media, biometric, or payload columns exist.
- A synthetic-only row passed
  `pending → verified_unpurged → verified`, with non-null purge evidence,
  then account cascade deletion left zero residual users, profiles,
  profile basics, or identity rows.
- The branch is non-default and set to expire automatically; the primary/default
  branch was not mutated.

## Current L1–L10 disposition

| Gate | Disposition | Concrete evidence |
| --- | --- | --- |
| L1 Contract/roles | BLOCKED_EVIDENCE | Console legal surfaces did not expose UNSTANDARD's accepted terms/DPA version, entity, or acceptance time. |
| L2 Region/subprocessors | BLOCKED_EVIDENCE | No account-bound proof of processing/biometric region, support access, binding subprocessors, or transfer mechanism was available. |
| L3 Data minimization | CONDITIONAL_PASS | Sandbox workflow readback proves Korea-only documents, age 19, and one optional Returned Data point (DOB) plus provider-mandated system fields; controller-approved minimum scope is still absent. |
| L4 Retention/erasure | CONDITIONAL_PASS | Sandbox shows one-month retention and delete-with-session templates; code has purge-before-verified and retry cleanup, but provider deletion E2E is still absent. |
| L5 Korean notice | BLOCKED | Current notice intentionally says Didit is inactive; controller-approved final factual notice is absent. |
| L6 Workflow | CONDITIONAL_PASS | Exact Sandbox workflow, Korea/document scope, age 19, and Preview workflow binding are evidenced; legal approval and live collection authorization are absent. |
| L7 Webhook | CONDITIONAL_PASS | Sandbox Preview destination is active for two events; code verifies fresh signatures and persists schedule before `202`, but no completed delivery/retry record exists. |
| L8 Preview environment | CONDITIONAL_PASS | Required values are present in the PR Preview branch, including a masked webhook secret; Production is not selected. |
| L9 Reachability | CONDITIONAL_PASS | The predecessor snapshot records `/privacy` 200 and the POST-only webhook route 405; the final exact-head route evidence is in the PR #80 closure body, and no identity E2E pass is claimed. |
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
