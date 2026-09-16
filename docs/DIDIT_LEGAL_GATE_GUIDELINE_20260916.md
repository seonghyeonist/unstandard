# Didit identity legal-gate and Preview release guideline

Status: **NOT READY — keep `IDENTITY_PROVIDER_NOTICE_READY=false`**

Date: 2026-09-16  
Repository: `seonghyeonist/unstandard`  
PR: #80, `feat/alpha-profile-identity-20260828`  
Scope: Closed Alpha Preview only. This document is an execution checklist, not legal advice or a substitute for a controller-side approval.

## 1. Non-negotiable release invariants

- PR #80 stays **OPEN / DRAFT**. Do not merge it.
- `IDENTITY_PROVIDER_NOTICE_READY=false` remains the fail-closed default until every evidence item in section 3 is approved by the controller-side owner.
- Do not infer consent, a signed DPA, a published notice, or a confirmed processing region from API credentials or a sandbox UI.
- Never put API keys, webhook secrets, session identifiers, identity data, documents, face media, or raw provider responses in GitHub, PR comments, screenshots, test fixtures, or logs.
- Production Vercel, Production environment variables, `main`, the default Neon branch, and migration history are outside this Preview gate. They require a separate written release decision even if a technical operator has access.
- A successful sandbox workflow does not prove production legal readiness.

## 2. Current observed state (must be rechecked before release)

| Area | Observed state | Release interpretation |
| --- | --- | --- |
| Code gate | `IDENTITY_PROVIDER_NOTICE_READY=false` | Correctly blocked |
| Didit account | Sandbox/test mode | Not a production approval |
| Didit retention | Account UI set to 1 month; biometric-template option set to delete with session | Preserve redacted evidence and obtain account/legal confirmation |
| Workflow | Sandbox `Free KYC`; ID verification, liveness, face match, and device/IP analysis selected; South Korea configured with minimum age 19 and reject-under-age behavior | Confirm workflow is published and matches the notice |
| Webhook | `PR80 Preview` target exists for `status.updated` and `data.updated` | Secret transfer and first delivery are still outstanding |
| Preview binding | Exact PR branch is the intended scope for the Didit API key, workflow ID, and identity flag | Redeploy and recheck exact-head binding; do not reveal values |
| Preview reachability | The project-level Vercel Authentication setting was changed to permit external callback reachability | This is broader than a branch-only exception; document the decision or replace it with a scoped protection-bypass design |
| Privacy notice | Current page says Didit is a preparation target and the provider is inactive | Cannot activate identity collection against this text |
| E2E | Not run | Must remain `DIDIT_E2E=NOT_RUN` |

The table records operational observations only. It is not an approval record.

## 3. Evidence packet required before gate promotion

Create a redacted evidence packet outside the repository, with an owner, source URL or document reference, capture time, and hash where practical. The packet must be approved by the controller-side legal/privacy owner.

| ID | Required evidence | Acceptable proof | Current disposition |
| --- | --- | --- | --- |
| L1 | Controller/processor roles | Executed DPA or equivalent contract naming the customer as controller and Didit as processor, with effective date and contracting entity | **Missing** |
| L2 | Subprocessors, data region, and transfer mechanism | Account-specific written confirmation or contract annex naming the actual region(s), subprocessors, transfer mechanism, and support access model | **Not confirmed** |
| L3 | Purpose and data categories | Approved data map covering identity fields, document/media, liveness/face-match outputs, device/IP signals, webhook payloads, and local records | **Draft only** |
| L4 | Retention and deletion | Approved retention schedule for Didit sessions, biometric templates/embeddings, webhook payloads, local state, logs, backups, and recovery history; include the tested delete request and outcome | **Operational setting observed; approval missing** |
| L5 | User notice and version | Final Korean privacy notice with notice version, effective timestamp, controller/contact, purposes, categories, processor, region/transfer, retention/deletion, rights, and consent withdrawal path | **Missing; current notice says Didit inactive** |
| L6 | Account and workflow | Redacted Didit account evidence for sandbox mode, workflow ID, publication state, Korean document scope, age rule, selected checks, and language behavior | **Partially observed; publication and final scope need confirmation** |
| L7 | Webhook security | Destination URL, subscribed events, v3 signature scheme, secret ownership/rotation record, timestamp tolerance, retry handling, and a redacted successful delivery record | **Destination exists; secret/delivery missing** |
| L8 | Preview-only configuration | Exact branch/environment matrix showing API key, workflow ID, webhook secret, callback origin, and feature flag are Preview-only; no values are revealed | **Partially configured; secret and redeploy outstanding** |
| L9 | Reachability and protection | Exact deployment URL, exact Git SHA, external HTTPS probe, callback behavior, and approved protection design. Prove no sensitive callback data is put in a URL | **Probe observed; current project-wide exposure needs review** |
| L10 | Test identity and consent | Controller-approved sandbox test subject, permitted test document path, explicit test consent, and purge verification plan | **Missing** |

A screenshot of a masked value proves that a field exists; it does not prove that the value is correct, scoped, or authorized.

## 4. Controller approval record

The controller-side approval must identify:

- approving person and role;
- legal entity and applicable product/environment;
- DPA/terms reference and effective date;
- approved notice version and effective timestamp;
- approved data region/transfer and retention/deletion schedule;
- approved Didit workflow and test scope;
- approved Preview URL/branch and webhook destination;
- approval date, expiry/review date, and any conditions.

Do not fill these fields with invented names, dates, signatures, or legal conclusions. If the DPA signing dialog requires signer name, title, legal company name, and email, the authorized human signer must provide and submit those details.

## 5. Privacy notice minimum content before activation

The notice shown immediately before the identity consent must be versioned and must state, in Korean and in plain language:

1. why identity/adult verification is required;
2. the exact categories sent to Didit, including document, liveness/face-match, and device/IP signals;
3. that Unstandard is the controller and Didit is the processor, subject to the executed contract;
4. the actual processing region(s), transfer mechanism, and relevant subprocessors;
5. Didit session/template retention and deletion behavior, local retention, logs, backups, and recovery history;
6. what Unstandard stores locally (opaque identifiers, status, timestamps, consent/version records) and what it does not store;
7. how a user can withdraw consent, request deletion, or contact the controller;
8. notice version and effective date;
9. a statement that a sandbox/test flow is not production verification, if applicable.

The notice must be updated in the same reviewed release change as the gate promotion. Do not flip the constant first and repair the notice later.

## 6. Technical promotion sequence after L1–L10 approval

1. Attach the approved evidence references to the release record; keep secrets and raw identity data out of GitHub.
2. Update the Korean privacy notice and its version in the reviewed PR commit.
3. Change `IDENTITY_PROVIDER_NOTICE_READY` only in that reviewed release commit. Keep the default fail-closed.
4. Store the Didit webhook secret only in the exact Preview environment scope; rotate it if it was exposed or copied into an unsafe location.
5. Redeploy from the reviewed commit and confirm Vercel Git SHA equals GitHub HEAD.
6. Verify the public HTTPS webhook/callback path and the protection decision. Prefer a scoped protection bypass or an equivalent reviewed non-production design over broad project exposure.
7. Run one approved sandbox E2E with a synthetic/vendor test identity:

   `consent → Didit start → hosted verification → webhook/callback → canonical decision → approval conditions → purge → local verified → PII-free log review`

8. Confirm all of the following in the E2E record:
   - the webhook signature and timestamp checks pass;
   - the canonical provider decision is fetched server-side;
   - only the required four checks and age condition permit approval;
   - the provider session is deleted and the configured biometric-template deletion behavior is confirmed;
   - local state reaches `verified` only after purge;
   - no name, phone, DOB, CI/DI, document, media, face template, secret, authorization header, or raw provider response appears in logs.
9. Rerun and attach results for:
   - `npm run check`;
   - security audit;
   - legacy and boundary guards;
   - GitHub CI and Rebuild CI;
   - Vercel exact-head `READY`;
   - Neon count-only/schema verification on the isolated verification branch.
10. Keep the PR OPEN/DRAFT until a human reviewer marks the release evidence complete. Do not merge as part of this procedure.

## 7. Failure and rollback

If any evidence is withdrawn, a notice changes, a webhook secret is uncertain, a region/retention fact changes, or an E2E purge/log check fails:

- set the identity flag back to disabled in the next reviewed commit;
- keep `IDENTITY_PROVIDER_NOTICE_READY=false`;
- stop new Didit session creation;
- rotate/revoke the webhook secret and remove the target if the destination is no longer approved;
- retain only the minimum operational records needed to investigate and follow the approved deletion schedule;
- record the exact deployment SHA and reason;
- do not promote, merge, or touch Production/main/default Neon.

## 8. Official technical references

- Didit [Security and compliance](https://docs.didit.me/getting-started/security-compliance)
- Didit [Delete Session](https://docs.didit.me/sessions-api/delete-session)
- Didit [Webhooks](https://docs.didit.me/integration/webhooks)
- Didit [Create Session](https://docs.didit.me/sessions-api/create-session)

**Decision:** Until L1–L10 are approved and the notice is published, `IDENTITY_PROVIDER_NOTICE_READY=false`, `DIDIT_CONFIG=BLOCKED_LEGAL_NOTICE`, `DIDIT_E2E=NOT_RUN`, and `CLOSED_ALPHA_READY=NO`.
