# Didit Preview reconciliation and gate record — 2026-09-21

Status: **BLOCKED_EVIDENCE — fail closed**

## Revalidation snapshot — 2026-09-22

This snapshot records a fresh read-only recheck after the final exact-head
verification packet. It does not enable collection, change Production, or
replace the legal/controller gates below.

## Approval and account-control follow-up — 2026-09-22

The controller authorized the four remaining workstreams for the closed-alpha review. That instruction is recorded as a decision to proceed with evidence collection; it is not, by itself, an account-bound DPA signature, a provider-region attestation, or proof that a provider setting changed.

### Public contract and transfer facts read on 2026-09-22

- Didit's Business Terms are dated **September 4, 2026**. They state that model training is allowed by default and that an organization owner or administrator may opt out under Organization Settings. The opt-out is described as applying to historical and newly collected data for future training, fine-tuning, evaluation, validation, dataset curation, and training-data exports.
- The Business Terms' Annex 2 DPA says Didit's primary processing infrastructure is in the EEA and that transfers outside the EEA use an applicable lawful mechanism such as SCCs, UK/Swiss addenda, or an adequacy decision. It also says the current sub-processor list and processing locations are available after an NDA, so the public terms are not account-specific sub-processor evidence.
- The same DPA says verification-flow retention defaults to unlimited unless the client configures a shorter application value, with an allowed configuration range of 30 days to 10 years. The Sandbox application readback is one month, and biometric templates are configured to delete with the session.
- The public Verification Privacy Notice states that verification data may be processed outside the country where the flow began and that appropriate transfer safeguards apply where required. It distinguishes operational session deletion from privacy erasure, which also purges retained biometric templates.

### Account-control result

- The connected Sandbox account user was read back as organization owner. The model-improvement control was initially **Allowed**.
- On 2026-09-22, the owner switched the control off, confirmed the explicit “모델 개선에서 옵트아웃하시겠습니까?” dialog, and received the Didit toast **“모델 개선 옵트아웃이 저장되었습니다”**.
- After a three-second wait and a full page reload, the account readback remained **옵트아웃됨** with DOM state `aria-checked=false` and `data-state=unchecked`. The audit-log page showed only read requests in the visible latest rows and no corresponding model-improvement write row; the persistent account-setting readback is the primary evidence. No document, selfie, or real identity was submitted.
- Didit support ticket **#59707** remains the account-specific channel for contract/DPA, processing-region, sub-processor, and permitted-test-flow confirmation.

### Sandbox synthetic-session cleanup attempt — 2026-09-22

- A Free KYC Sandbox session was created with the synthetic internal reference `unstandard-sandbox-e2e-20260922`; no personal identity value was used.
- The hosted provider page visibly identified itself as **SANDBOX** and **test data only / no real call**. After language selection it exposed no document/selfie input or start control, so no approved synthetic identity decision and no webhook delivery were generated.
- The Didit verification list showed the exact synthetic row as **시작 안 함**. It was deleted from the console with **세션과 함께 생체 인식 템플릿 삭제** selected; after reload the row was absent and the list reported no available data.
- This proves console-level cleanup for an unstarted Sandbox session. It is not a provider decision/webhook-delivery/canonical-decision/purge E2E pass. Full E2E remains not run because the provider test page did not expose a usable test fixture and the Preview app has no available test login/session fixture; `IDENTITY_PROVIDER_NOTICE_READY=false` remains fail-closed.

### Legal notice disposition

The existing Korean privacy page continues to say that Didit is not an active processor, and the code gate remains deliberately fail-closed. The Sandbox model-improvement control now reads opted out. A final Didit-active Korean notice must still not be published or used to open collection until the account-specific contract/DPA, processing-region, sub-processor, and transfer evidence is available. The controller-approved scope can be applied to the draft once those remaining account facts are read back.

### Preview and CI

- Before this documentation commit, the exact branch HEAD was
  `bbf2d7e237d29a9bd637ef0e05906d77170f1f0b`.
- GitHub Actions for that HEAD remain green: CI #219
  (`35654156620`) and Rebuild CI #159 (`35654156668`).
- Vercel deployment `dpl_4qqBkaJ99UYn9dgxyRT5R1KaK4xX` is READY and reports
  the exact branch and SHA. Its exact-deployment runtime read showed only the
  expected `GET /api/identity/webhook → 405`; no runtime error was recorded
  for that deployment. The project-level `NOTICE_NOT_READY` cluster belongs
  to an older deployment and is the intentional fail-closed provider response.

### Fresh Sandbox readback

- Didit remains in test mode; no real identity session was submitted.
- Free KYC workflow `906530b5-e097-481d-aaae-21b7b5e71fbb` is active with
  Korea selected and National ID card / Driver's license visible in the
  preview.
- Returned Data shows **1 of 35** optional points: date of birth. The
  provider-mandated status, warning, and node ID are the only system fields.
- Application data retention is **1 month** and biometric templates are
  **deleted with the session**.
- The active `PR80 Preview` webhook is v3 with **2 of 11** events
  (`status.updated`, `data.updated`); the console reports no completed
  delivery.
- The organization-level Didit model-improvement control now reads
  **옵트아웃됨** after the owner confirmed the opt-out dialog. A full reload
  retained `aria-checked=false` and `data-state=unchecked`. No identity
  collection was enabled and no document/selfie/real identity was submitted.

### Isolated Neon readback

- Disposable branch `br-snowy-grass-ajz5bj7f` is non-default,
  non-primary, ready, and still reports `written_data_bytes=0`.
- Read-only SQL returned 14 migration rows, 5 users, 5 accounts, 5
  profiles, 0 profile basics, 0 identity verifications, and 0 legal
  acceptances.
- The identity table contains only opaque references, state, timestamps,
  notice/consent versions, and purge evidence; no raw identity, document,
  media, biometric, or provider-payload columns were present.

The final gate remains `IDENTITY_PROVIDER_NOTICE_READY=false` and
`CLOSED_ALPHA_READY=NO`. The remaining human/account actions are therefore
unchanged, with the model-improvement setting added to the account evidence
checklist.


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
| L4 Retention/erasure | CONDITIONAL_PASS | Sandbox shows one-month retention and delete-with-session templates; the unstarted synthetic session disappeared after console deletion with biometric-template deletion selected; provider decision/deletion E2E is still absent. |
| L5 Korean notice | BLOCKED | Current notice intentionally says Didit is inactive; controller-approved final factual notice is absent. |
| L6 Workflow | CONDITIONAL_PASS | Exact Sandbox workflow, Korea/document scope, age 19, and Preview workflow binding are evidenced; legal approval and live collection authorization are absent. |
| L7 Webhook | CONDITIONAL_PASS | Sandbox Preview destination is active for two events; code verifies fresh signatures and persists schedule before `202`, but no completed delivery/retry record exists. |
| L8 Preview environment | CONDITIONAL_PASS | Required values are present in the PR Preview branch, including a masked webhook secret; Production is not selected. |
| L9 Reachability | CONDITIONAL_PASS | The predecessor snapshot records `/privacy` 200 and the POST-only webhook route 405; the final exact-head route evidence is in the PR #80 closure body, and no identity E2E pass is claimed. |
| L10 Synthetic identity | BLOCKED | No controller-approved vendor/synthetic test subject and consent fixture is available. |

## Gate state

```text
DIDIT_CONFIG=BLOCKED_LEGAL_NOTICE
DIDIT_E2E=PARTIAL_SANDBOX_SESSION_CLEANUP_ONLY
DIDIT_PROVIDER_DECISION_DELIVERY=NOT_RUN
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
