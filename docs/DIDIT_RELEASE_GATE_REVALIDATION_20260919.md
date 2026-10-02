# Didit release-gate revalidation — 2026-09-19

Status: BLOCKED_EVIDENCE — fail closed

This is an engineering/privacy release-gate record for PR #80. It records read-only revalidation of the current PR Preview and the connected Didit Business Console. It is not a legal opinion, DPA acceptance, or approval to collect live identity data.

## Non-negotiable scope

- PR #80 remains OPEN / DRAFT / unmerged; no merge was performed.
- Production Vercel, main, production environment variables/domains, and default/primary Neon were not changed.
- No real identity document, face image/video, date of birth, phone number, or raw provider decision was submitted or stored.
- The code gate remains IDENTITY_PROVIDER_NOTICE_READY=false, DIDIT_LIVE_COLLECTION=BLOCKED, and CLOSED_ALPHA_READY=NO.
- No Didit workflow setting, retention setting, API key, webhook destination, or secret was created, rotated, copied, or saved.

## Current code and platform provenance

- Repository/PR: seonghyeonist/unstandard / #80
- Branch: feat/alpha-profile-identity-20260828
- Code snapshot used for this read-only revalidation: f28b3227085ae6e569364c16b6a83de0e9078ee8
- The documentation-only commit that records this pass must be followed by a fresh exact-head CI and Vercel check before any further conclusion.
- Prior exact-head GitHub CI and Rebuild CI were both SUCCESS.
- The exact-head Git-linked Preview was READY at Vercel project unstandard-m9qj, branch target, with function region iad1 (Washington, D.C., USA). Runtime-log grouping for the checked seven-day window returned no entries.
- The Korean privacy route returned HTTP 200 and states that Didit is a preparation target/inactive processor.

## Neon safety and schema read

- Project: unstandard-alpha-preview-app-db / raspy-fog-00907976; region aws-us-east-2.
- Verification branch: pr80-verification-clean-20260904 / br-hidden-rice-aj5bed7o; archived, non-default, non-primary, read-only for this pass.
- Count-only read: users=5, accounts=5, profile_basics=1, identity_verifications=0, legal_acceptances=0, alpha_invites=17, alpha_email_verifications=0.
- Schema read confirmed pending -> verified_unpurged -> verified constraints and provider purge evidence before final verified.
- No identity verification row or raw identity payload was created. The default/primary Neon branch was not written.

## Didit account evidence observed read-only

The console review was on the live My Application. The sandbox application is present in the organization, but the repository's DIDIT_WORKFLOW_ID and Preview-only environment binding were not exposed by the connected Vercel integration, so no live/sandbox binding is claimed.

- Workflow: Free KYC in the live application. ID verification, liveness, face matching, and device/IP analysis were selected.
- South Korea: 5/5 document methods enabled in the workflow preview: National ID card, Passport, Driver's license, Residence permit, and Social security card.
- South Korea age rule: minimum age displayed as 18. The application code requires age 19 or older. This is a direct workflow-policy mismatch and blocks L6.
- Returned Data: 35/35 data points included. The enabled groups include identity/document details, personal data including date of birth, document validity, address, media assets including document/portrait media, quality scores, and other result fields. This is not a minimized configuration and blocks L3/L6.
- Advanced settings: camera scan and file upload were both enabled. No identity capture was started.
- Application data retention: unlimited. Biometric template policy: delete with session selected. This is account evidence, but it is not an approved Unstandard retention/erasure package and no deletion E2E was run.
- Organization data-use control displayed opt-out for Didit model improvement. This is an account observation, not a substitute for the contractual evidence package.
- Webhooks: no destination was configured in the live application. The active live API key was not copied or rotated.
- Terms and policies page exposed MSA/DPA/SLA/privacy-notice documents and sign/download controls, but did not expose an accepted document version and acceptance timestamp. L1 remains NOT_PROVEN.

## L1-L10 disposition

| Gate | Disposition | Evidence-based reason |
| --- | --- | --- |
| L1 Contract/roles | BLOCKED_EVIDENCE | Public/account document links exist, but accepted entity, version, effective time, and binding DPA evidence are absent. |
| L2 Region/subprocessors | BLOCKED_EVIDENCE | Public material is not account-bound; actual processing/biometric region, access, subprocessors, and transfer mechanism are not proven. |
| L3 Data map/minimization | BLOCKED | Code path is mapped, but live Returned Data is 35/35 and upload is enabled; provider-side minimization is not acceptable or proven. |
| L4 Retention/erasure | BLOCKED_EVIDENCE | Account shows unlimited session retention and delete-with-session templates; code is fail-closed, but approved policy and deletion E2E are absent. |
| L5 Korean notice/consent | BLOCKED | The product notice still says inactive/preparation; no approved Korean biometric/cross-border/automated-decision notice package exists. |
| L6 Workflow | BLOCKED | Live workflow is not bound to Preview; Korea is configured for age 18 and five document types, while application policy requires age 19 and narrower approved scope. |
| L7 Webhook | CODE_CONDITIONAL_PASS / ACCOUNT_BLOCKED | Code completes synchronously and returns retryable 503 for transient completion failures; the live account has no webhook destination or delivery evidence. |
| L8 Preview environment | NOT_EVIDENCED | Exact branch-linked Preview exists, but Vercel environment-variable bindings were not exposed and no value was read. |
| L9 Reachability | PARTIAL / NOT_PROVEN | Exact-head Preview and privacy route were reachable; Didit callback reachability cannot be proven without a configured destination and delivery evidence. |
| L10 Synthetic identity | BLOCKED | No approved synthetic/vendor identity and consent artifact exists; no hosted session or live collection was started. |

## Gate state

DIDIT_PUBLIC_DUE_DILIGENCE=CONDITIONAL_PASS
DIDIT_ACCOUNT_LEGAL_EVIDENCE=BLOCKED_EVIDENCE
DIDIT_CONFIG=BLOCKED_LEGAL_NOTICE
DIDIT_E2E=NOT_RUN
DIDIT_LIVE_COLLECTION=BLOCKED
IDENTITY_PROVIDER_NOTICE_READY=false
CLOSED_ALPHA_READY=NO

## Official references

- Didit Webhooks: https://docs.didit.me/integration/webhooks
- Didit Delete Session: https://docs.didit.me/sessions-api/delete-session
- Didit DPA, data residency and subprocessors: https://help.didit.me/data-privacy/dpa-and-data-residency
- Didit model-training opt-out: https://help.didit.me/data-privacy/opt-out-of-model-training
- Vercel Regions: https://vercel.com/docs/regions

## Required next evidence

Before any E2E or gate change, obtain controller-approved legal/DPA evidence, account-bound region/subprocessor/transfer evidence, a minimized workflow with age 19 policy and approved Korean document scope, finite retention/erasure proof, an approved Korean notice/consent package, a configured Preview-only webhook destination with delivery history, exact Preview environment binding evidence, and an approved synthetic identity/consent fixture. Until then, do not enable collection.