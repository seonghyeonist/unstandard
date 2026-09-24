# PR #80 pre-production gate state — 2026-09-24

This is the current evidence snapshot for PR #80. Older Didit notes are historical snapshots; in particular, the prior “no signature” readback is superseded by the later DocuSeal completion email and attached DPA reviewed on 2026-09-24.

## Current decision

| Gate | State | Evidence / remaining action |
|---|---|---|
| PR #80 | Open, draft, unmerged | Keep this state. No merge or Production change is authorized. |
| `IDENTITY_PROVIDER_NOTICE_READY` | `false` | Keep Didit identity collection fail-closed. The public `/privacy` page says Didit collection is inactive. |
| `PR80_PREPROD_RELEASE_CANDIDATE_READY` | `NO` | Provider entity/account evidence, provider E2E, and live disposable-branch integration remain incomplete. |
| `CLOSED_ALPHA_PRODUCTION_READY` | `NO` | Production readiness is outside this task and remains gated. |

## Didit contract and account evidence

- A founder-side DocuSeal completion email dated 2026-09-23 was found. Its subject describes “Business Terms & DPA”; the attached eight-page document contains the **Data Processing Addendum v2, last updated 2026-07-15**, and names Didit Identity Spain, S.L. It says the DPA forms part of a separate Master Services Agreement and Business Terms. The attached document does not include the text/version of those Business Terms or the MSA.
- This confirms a client-side signature submission for the attached DPA. It does not prove provider countersignature, assignment to the Didit organization, the recognized customer entity, or account-bound acceptance of the separate Business Terms/MSA.
- The authenticated organization has no Legal Name or Tax ID entered. Didit's support reply in ticket #59707 says Korean customers ordinarily contract with Didit Identity, Inc. This conflicts with the Spain entity named in the founder-side DPA.
- The founder's follow-up asking Didit to assign the organization to the Spain entity, identify the pre-incorporation customer name/jurisdiction, and confirm any correction or re-signing procedure has been sent. Status: `WAITING_EXTERNAL_PROVIDER`. The message does not accept or amend terms.
- The organization model-improvement control reads opted out. The account setting is confirmed; its contractual effect and coverage for this exact account still need written confirmation.
- The current **live application** retention setting reads unlimited, with biometric-template deletion set to delete with the session. No live app setting was changed. The Sandbox application's current retention and workflow settings have not been re-read for this snapshot.

### Public provider baseline vs. account-specific facts

Ticket #59707 described EU/Ireland processing, AWS EMEA SARL, and Google Maps use for proof-of-address checks; the DPA describes transfer safeguards in general terms. These are provider/public statements, not confirmation of this organization's exact region, support-access locations, subprocessor set, or transfer mechanism. The exact account-specific facts remain unconfirmed. Do not use them as established notice facts.

## Data path and local retention

The PR code path is browser → Didit hosted session → Didit webhook/canonical decision request → Vercel Preview → Neon. The local identity table stores the account key, opaque request/provider references, status, profile revision, notice/consent versions, timestamps, completion event ID, and verification/purge state. It has no document-image, selfie, biometric-template, or full provider-payload columns. Identity logging is allow-listed and omits request IDs, account identifiers, provider bodies, IP addresses, and error text.

Migration 0014 adds a purge queue with only request UUID, provider ID, opaque provider reference, retry count, and scheduling timestamps. A delete trigger enqueues unpurged Didit references; the migration adds no user ID or identity payload to the queue. Provider-side capture/storage, actual regional routing, and retention of this organization's sessions still depend on Didit account configuration and written confirmation.

## Neon and migration 0014

- Verified Neon project: `unstandard-alpha-preview-app-db`, `aws-us-east-2`.
- Target: disposable non-default branch `pr80-runner-ledger-20260924`, with expiry `2026-09-27T00:00:00Z`.
- The repository command `npm run db:migrate` completed successfully against that branch. Its newest Drizzle ledger record is migration 0014; the recorded hash matches `drizzle/migrations/0014_identity_provider_purge_queue.sql` exactly. The queue table, six expected columns, checks, and `AFTER DELETE` trigger were read back.
- The default branch was read-only checked; it remained unchanged (nine migration-ledger rows, max ID 9). No default/primary branch write was issued.
- An actual `npm run test:integration` against the disposable branch was attempted. Shell DB access was stopped when the network approval was cancelled before a decision returned. Therefore deletion-cascade, queue insertion, retry/backoff, and bounded-reconciliation integration results are **not claimed as passed**.
- To bypass the shell-network bottleneck without exposing a connection string, an assertion-based SQL probe ran through the Neon connector against the same disposable branch. It passed account-deletion cascade, six-column opaque queue shape, duplicate-request idempotency, one-minute retry/backoff, and 50-row due-query checks; a cleanup readback confirmed zero synthetic users and zero queue rows. This is DB-level evidence, **not** a passing result for the Node `npm run test:integration` suite.
- A regression case covering opaque queue data, duplicate-request idempotency, retry schedule, and 50-row bound is included in this PR change. It still requires execution on a runner with authorized access to the disposable branch.

## Didit Sandbox and webhook

Didit has a separate Sandbox application. Its official documentation describes per-application keys, mocked outcomes selectable with `sandbox_scenario` or a hosted-flow scenario picker, and official sample documents. It also warns that Sandbox stores captured media like Live, so only official sample documents/test data are suitable. The console's “Try Webhook” can send a sample event. No new verification session, provider decision, webhook delivery, or purge was executed in this snapshot; mark Sandbox, webhook, and provider-purge E2E as `NOT_RUN`.

References: Didit Help Center, [Sandbox testing](https://help.didit.me/getting-started/sandbox-and-testing) and [webhook basics](https://help.didit.me/integration/webhooks-basics).

## Human label review

**PR #80 procedure: `WAIVED_BY_FOUNDER / NOT_PERFORMED`.** The founder has waived the human-labeling step for this closure as an unavoidable procedural decision. Reviewer assignment is not a remaining action or a blocker for PR #80.

- The source workbook hash matches the previously audited source. It contains 1,000 physical rows, 260 unique question–answer pairs, and no completed Reviewer 1, Reviewer 2, or final labels.
- A deterministic 225-unique-pair sample, two identical blind reviewer workbooks, a separate controller crosswalk, and a blank merged-results template were prepared in an operator-local directory. The reviewer views contain only pair ID, question text, answer text, label, and notes; categories, source row IDs, recommendations, paths, and expected scores are absent.
- The source dataset gate prohibits uploading row-level data or derivatives to third-party services. No row-level workbook or crosswalk was uploaded to Drive, Git, email, or chat. Drive search found no earlier reviewer packet or crosswalk.
- The ingestion tool and synthetic tests remain available for a separately authorized future review. No human labels, human-review statistics, or independent human ground truth were produced.
- This procedural waiver is **not** evidence of human ground truth and does not support calibration, accuracy, or model-quality claims. It does not authorize separate Local AI execution or calibration; those remain governed by their own authorization and readiness gates.

If human labeling is separately reauthorized later, install the pinned `openpyxl` dependency from `scripts/local-ai/requirements-human-review.txt` and run `python3 scripts/local-ai/analyze_human_review_results.py --directory <operator-local-packet-directory>`. The CLI refuses incomplete or mismatched packets and writes only local outputs; never put reviewer workbooks or row-level merged labels in Git, Drive, email, or chat.

## Local validation and rollback boundary

On the PR change set based on `eb1c382c5a9756ad4155077b7b00a5c0ea1d6c9c`, `npm run check`, `npm run audit:security`, `npm run guard:no-legacy-backend`, `npm run guard:boundaries`, and the local synthetic human-review tool tests passed. Exact-head GitHub CI/Rebuild and Vercel Preview status must be re-read after this change is committed; results from the earlier SHA do not establish the updated head.

No Production deployment, Production environment, `main`, default Neon branch, live Didit workflow, contract, or provider collection setting was modified. The Neon verification branch expires automatically on 2026-09-27. If the PR change needs rollback, revert its commit on the feature branch; leave the Production and default-branch boundaries untouched.
