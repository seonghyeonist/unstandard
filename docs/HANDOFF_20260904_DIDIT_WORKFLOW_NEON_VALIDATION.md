# 2026-09-04 Didit workflow + Neon disposable validation handoff

## Verdict

**TECH_PREPARED_AWAITING_EXTERNAL_DIDIT_BINDING**

This narrows the 2026-09-03 handoff but does **not** authorize Closed Alpha invitations, Production identity collection, a Production migration, or a main merge.

A founder-run Didit hosted verification has completed successfully. Treat that only as evidence that a Didit account/workflow and happy-path hosted verification exist. It is **not** proof of API integration, webhook validation, provider purge behavior, sandbox/live separation, Korean four-document coverage, retention/privacy facts, or legal readiness.

## Exact repository state checked

- Repository: `seonghyeonist/unstandard`
- Draft PR: #80
- PR head at validation start: `9a7e4e326b8012a8349a789dd29c9346b846a82c`
- PR branch: `feat/alpha-profile-identity-20260828`
- GitHub CI at that head: `CI` PASS and `Rebuild CI` PASS
- `main` has independently advanced after PR #80's original base. Current observed main/Production deployment SHA is `30d0c78ee19d652fed2bedcae7271931f8f04b31`; do not confuse this with PR #80's tested head.

## Didit workflow facts checked

Founder-provided integration material names workflow id `39be5634-7c84-42d5-b369-9dc1b27523ea` as **Free KYC**. This UUID is a configuration value, not a secret. It is a **candidate** sandbox workflow id until the Didit console/API confirms that it belongs to the intended sandbox application.

Official Didit V3 documentation was cross-checked on 2026-09-04:

- Create Session accepts a KYC `workflow_id` in the `POST /v3/session/` body and returns a hosted verification `url`.
- Retrieve Session exposes the configured `features` as display names. The four names required by the current adapter are exactly `ID_VERIFICATION`, `LIVENESS`, `FACE_MATCH`, and `IP_ANALYSIS`.
- V3 decisions expose plural arrays `id_verifications[]`, `liveness_checks[]`, `face_matches[]`, and `ip_analyses[]`.
- Webhooks recommend `X-Signature-V2`, five-minute timestamp freshness and constant-time HMAC verification; `X-Signature-Simple` authenticates only the envelope, so a canonical API re-fetch remains mandatory when it is used.
- `DELETE /v3/session/{sessionId}/delete/` currently returns HTTP 200 JSON with `face_retention_outcome` and `biometric_template_uuid`; a delete with `retain_face_embeddings: false` is compatible with the current fail-closed purge contract.

References:

- https://docs.didit.me/sessions-api/create-session
- https://docs.didit.me/sessions-api/retrieve-session
- https://docs.didit.me/sessions-api/delete-session
- https://docs.didit.me/integration/webhooks

### Consequence for current code

No `OCR` -> `ID_VERIFICATION` bug was found in the existing strict decision check. `OCR` is a workflow-construction enum, while the retrieved session `features` list uses the `ID_VERIFICATION` display name. The existing adapter's strict four-feature check is therefore consistent with the current Didit V3 retrieval contract, provided the actual Free KYC workflow contains exactly those four required modules.

The existing architecture remains intentionally stricter than the generic Didit sample:

- API key stays server-side.
- Browser callback / SDK completion is never approval evidence.
- The server re-fetches the canonical decision.
- All four checks plus document DOB adult-age logic must pass.
- Raw Didit identity fields/media do not cross the provider adapter into application persistence.
- The provider session is deleted before local state reaches final `verified`.

Do not replace this with a generic `Approved -> store decision` sample.

## Neon disposable migration validation

Project used: `unstandard-alpha-integration-disposable` (`sweet-king-54269784`).

The disposable project's parent database was behind the PR's identity schema, so migrations `0008` through `0011` were prepared together on a Neon temporary migration branch rather than applying anything to Production or to the disposable parent.

Temporary migration branch:

- branch id: `br-sparkling-rain-athozei6`
- migration id: `d5183b08-0049-4be1-92c7-169cada72650`
- parent branch id: `br-fancy-snow-atha821h`

Validation completed on the temporary branch:

1. `identity_verifications`, `profile_basics`, and `legal_acceptances` were created successfully.
2. `identity_verifications` contains only opaque ids/status/version/timestamp/provider-reference fields. A column-name scan found no real name, document number, phone, DOB/birth, face/media, address, or email columns.
3. The final identity state machine constraints are present:
   - `pending`
   - `verified_unpurged`
   - `verified`
4. A synthetic transition `pending -> verified_unpurged -> verified` succeeded only after provider reference, verification timestamp, and purge evidence were populated.
5. Removing `provider_reference` from a verified row was rejected by `identity_provider_reference_check`.
6. Moving a verified row back to `pending` while retaining verification/purge evidence was rejected by `identity_result_check`.
7. Schema comparison against the disposable parent showed only the expected new legal/profile/identity tables, constraints, FKs, and indexes for this migration group.

**Important:** Neon `complete_database_migration` has not been called. The temporary migration has not been promoted to its parent branch. Production Neon was not changed.

## Vercel observation

Project: `unstandard-m9qj`.

The latest observed Production deployment is READY and points to main SHA `30d0c78ee19d652fed2bedcae7271931f8f04b31`. No Didit secret, OAuth secret, identity gate, Production database URL, or Production deployment was changed during this validation.

PR #80 still needs an exact-head Preview deployment wired to a disposable Neon branch and Preview-only provider credentials before authenticated external smoke can run.

## Blockers after this pass

| Blocker | State after 2026-09-04 validation | What closes it |
|---|---|---|
| `BLOCKED_EXTERNAL_DIDIT_ACCOUNT` | **NARROWED, NOT PASS** | confirm the successful founder session and candidate workflow belong to the intended sandbox application |
| `BLOCKED_EXTERNAL_DIDIT_SANDBOX_VALIDATION` | **OPEN** | API-created session + signed webhook + canonical decision + purge + local verified transition on exact Preview SHA |
| `BLOCKED_EXTERNAL_DIDIT_KOR_DOCUMENT_COVERAGE` | **OPEN** | console/workflow evidence that 주민등록증, 운전면허증, 대한민국 여권, 외국인등록증 are enabled/accepted for this application/workflow |
| `BLOCKED_EXTERNAL_DIDIT_PRIVACY_FACTS` | **OPEN** | DPA/subprocessors/region/retention/deletion/biometric-template facts, consent wording, pricing/limits confirmed |
| Neon disposable migration | **VALIDATED TEMPORARILY** | explicit approval to promote or explicit decision to discard the prepared migration |
| Preview smoke | **OPEN** | Preview env + exact-head deployment + authenticated OAuth/Didit smoke |

## Founder-side external actions still required

1. In Didit Business Console, confirm that `39be5634-7c84-42d5-b369-9dc1b27523ea` is the intended **sandbox** KYC workflow and contains ID verification, **passive** liveness, face match and IP analysis.
2. Confirm Korean document coverage in that exact application/workflow.
3. Create a V3 webhook destination for the exact Preview HTTPS origin at `/api/identity/webhook`, subscribing to `status.updated` and `data.updated`; capture its signing secret in the secret manager only.
4. Rotate the Didit API credential that was pasted into founder-provided chat/material before any Preview or Production deployment. Do not reuse the exposed credential as a long-lived Production secret.
5. Add only Preview-scoped Didit/OAuth secrets and a disposable Neon `DATABASE_URL`; keep Production untouched.
6. Finish the privacy/legal facts before changing `IDENTITY_PROVIDER_NOTICE_READY` from `false`.

## Next technical gate

After the external sandbox binding + webhook secret + Preview env exist:

1. deploy exact PR head to Preview;
2. create a Didit session through the application's server endpoint;
3. complete one approved sandbox flow and at least one declined/cancelled flow;
4. verify signed webhook delivery and canonical decision re-fetch;
5. verify provider deletion returns an accepted 200 JSON deletion outcome with no retained biometric template;
6. verify only provider-neutral local proof remains and no raw identity PII appears in DB/evidence/logs;
7. then update blockers. Do not declare `CLOSED_ALPHA_READY` until the separate same-SHA Production gates are rerun.
