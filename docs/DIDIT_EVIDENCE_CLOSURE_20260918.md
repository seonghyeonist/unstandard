# Didit evidence closure record — 2026-09-18

Status: **BLOCKED_EVIDENCE — fail closed**

This is an engineering/privacy release-gate record for PR #80. It is not a legal opinion, a DPA acceptance record, or approval to collect live identity data.

## Scope and invariants

- Repository: `seonghyeonist/unstandard`
- PR: #80, `feat: replace alpha OAuth with invite credential auth`
- Branch: `feat/alpha-profile-identity-20260828`
- PR state must remain OPEN / DRAFT / unmerged.
- The identity notice constant remains `IDENTITY_PROVIDER_NOTICE_READY=false`.
- Production Vercel, production environment variables/domains, `main`, default/primary Neon, and real identity collection are out of scope.

## Provenance snapshot

The prior exact-head baseline was `1c07884e0a875de54658d87448d9e8f4ee321007`. The safe code-closure commit created on the PR branch is `bb36347514c7120aa8971f81da130fc4620d892a`. This documentation commit follows it. After this documentation commit, GitHub CI and the Git-linked Vercel deployment must be re-read against the resulting exact HEAD; no E2E is permitted on a stale deployment.

### Previously verified Preview

| Field | Observed value | Interpretation |
| --- | --- | --- |
| Deployment | `dpl_Hw5eVPMDZ4urg8Ta1CHz5FR31R9B` | Previous exact-head Git-linked Preview |
| Git SHA | `1c07884e0a875de54658d87448d9e8f4ee321007` | Matches the pre-closure baseline only |
| Source/state | `git / READY` | Build/runtime availability, not legal approval |
| Branch alias | `unstandard-m9qj-git-feat-alpha-profile-identi-5d46bc-unstandard.vercel.app` | Preview branch alias observed |
| Function region | `iad1` | Washington, D.C., USA; identity server path is not EU-only |
| Privacy page | HTTP 200 | Page says Didit is a preparation target/inactive; this is consistent with the closed gate |

### Isolated Neon verification branch

| Field | Observed value |
| --- | --- |
| Project | `unstandard-alpha-preview-app-db` / `raspy-fog-00907976` |
| Region | `aws-us-east-2` |
| Branch | `pr80-verification-clean-20260904` / `br-hidden-rice-aj5bed7o` |
| Safety | non-default, non-primary, `written_data_bytes=0` |
| Count-only read | `users=5, accounts=5, profile_basics=1, identity_verifications=0, legal_acceptances=0, alpha_invites=17, alpha_email_verifications=0` |

Schema reads confirmed the identity state invariants: `pending` has no verification timestamp; `verified_unpurged` has no provider purge timestamp; final `verified` requires provider purge evidence. No identity row or live identity payload was created by this pass.

## Public evidence versus account evidence

| Question | Public baseline | Account-bound disposition |
| --- | --- | --- |
| Contracting entity | Public APAC baseline points to Didit Identity, Inc. | UNSTANDARD accepted entity, terms/DPA version, and acceptance timestamp: NOT_PROVEN |
| Region | Public material states EU/Ireland default processing | Actual account region, biometric region, support/intragroup access, and transfer mechanism: NOT_PROVEN |
| Subprocessors | Public material provides a baseline, including AWS EMEA SARL and conditional Google Maps/Cloud for Proof of Address | Binding account DPA/subprocessor version and applicability: NOT_PROVEN |
| Retention | Public material describes configurable retention and erasure | Approved account retention, template policy, existing retained data, and redacted evidence: NOT_PROVEN |
| Model training | Public opt-out setting exists and is separate from deletion/retention | UNSTANDARD organization opt-out evidence: NOT_PROVEN |
| Webhooks | Public V2 signing/retry behavior is documented | Destination ownership, secret rotation, delivery history, and exact account settings: NOT_PROVEN |

No public document was treated as proof of UNSTANDARD's accepted contract, DPA, account region, or account settings. No secret, raw provider response, raw identity data, or account credential is recorded here.

## Data map and minimization boundary

Observed engineering path:

1. Didit Hosted receives the provider-required identity material and performs provider-side checks, subject to the unproven account workflow and Returned Data configuration.
2. Didit webhook and server-side decision fetch reach the Preview Vercel runtime in `iad1`, USA. The server uses the canonical decision to validate document approval, liveness, face match, device/IP analysis, and `date_of_birth` for the current age >= 19 policy.
3. The backend sends only opaque local references, status, timestamps, notice/consent versions, and purge state to Neon `aws-us-east-2`, USA. It must not persist raw provider identity payloads.

Provider workflow Returned Data/Data Minimization toggles are not account-evidenced. Therefore L3/L6 remain partial even though the code schemas now strip unknown provider fields before proof evaluation.

## Code changes in this closure pass

Commit `bb36347514c7120aa8971f81da130fc4620d892a` (`fix: close Didit webhook retry and erasure gaps`):

- removed the Next.js `after()` fire-and-forget completion from the webhook route;
- completes canonical decision and purge ordering before acknowledging a valid matching webhook;
- returns HTTP 503 for lookup/provider/purge transient states so Didit retry can apply;
- keeps deterministic non-approval responses non-retryable;
- strips unknown Didit response fields before identity proof handling;
- supports explicit operational deletion versus `privacy_erasure` and uses privacy erasure for profile withdrawal;
- added static tests for the acknowledgement/retry and privacy-erasure boundaries;
- updated the integration notes to state that delivery and durable reconciliation still require evidence.

The change removes the previously identified `202 -> after() failure` acknowledgement gap. It does not prove provider delivery, sub-five-second completion, retries, or a durable reconciliation worker. Those remain blockers.

## L1–L10 disposition

| Gate | Current disposition | Reason |
| --- | --- | --- |
| L1 Contract/roles | PARTIAL / BLOCKED_EVIDENCE | Public baseline only; accepted terms/DPA/version/time not proven |
| L2 Region/subprocessors | PARTIAL / BLOCKED_EVIDENCE | Public baseline only; account region, binding list, access and transfer mechanism not proven |
| L3 Data map | PARTIAL+ | Code and Vercel/Neon route observed; provider Returned Data configuration not proven |
| L4 Retention/erasure | PARTIAL / BLOCKED_EVIDENCE | Code is fail-closed and profile withdrawal requests privacy erasure; account settings, template inventory, and E2E outcome not proven |
| L5 Korean notice/consent | BLOCKED | Current live page correctly says Didit inactive; approved final notice and legal basis package do not exist |
| L6 Workflow | PARTIAL / BLOCKED_EVIDENCE | Code enforces four checks and age >= 19; published workflow/Returned Data/Korea scope not proven |
| L7 Webhook | CONDITIONAL_PASS for code / NOT_PROVEN for delivery | Cryptographic and synchronous acknowledgement path improved; actual account delivery/rotation/retry evidence absent |
| L8 Preview environment | NOT_EVIDENCED | Exact current branch/environment variable bindings were not account-evidenced; no values were exposed |
| L9 Reachability | PARTIAL | Previous Preview URL and privacy route were reachable; Didit callback/delivery behavior and narrow protection design not proven |
| L10 Test identity/consent | BLOCKED | No approved synthetic/vendor identity or consent artifact available; no E2E run |

## Final gate state

```text
DIDIT_PUBLIC_DUE_DILIGENCE=CONDITIONAL_PASS
DIDIT_ACCOUNT_LEGAL_EVIDENCE=BLOCKED
DIDIT_CONFIG=BLOCKED_LEGAL_NOTICE
DIDIT_E2E=NOT_RUN
DIDIT_LIVE_COLLECTION=BLOCKED
IDENTITY_PROVIDER_NOTICE_READY=false
CLOSED_ALPHA_READY=NO
```

## Required next evidence

The next release step is account-owner evidence collection: exact accepted terms/DPA and effective time, account-bound region/subprocessors/access, model-training opt-out, minimal Returned Data, retention/template settings, webhook delivery/rotation, Preview-only variable binding, approved Korean notice/legal basis, and approved synthetic test identity. Until those artifacts are reviewed and the exact-head Preview is revalidated, do not run E2E or enable collection.

## References

- Didit [DPA, data residency and subprocessors](https://help.didit.me/data-privacy/dpa-and-data-residency)
- Didit [Delete Session and privacy erasure](https://docs.didit.me/sessions-api/delete-session)
- Didit [Opt out of model training](https://help.didit.me/data-privacy/opt-out-of-model-training)
- Didit [Webhook signatures and retry behavior](https://docs.didit.me/integration/webhooks)
- Vercel [Regions](https://vercel.com/docs/regions)
- Existing release checklist: `docs/DIDIT_LEGAL_GATE_GUIDELINE_20260916.md`