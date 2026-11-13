# UNSTANDARD pre-pivot audit — 2026-11-13 KST

## Verdict and scope

INCONCLUSIVE pending real database integration evidence. Source fixes and local regression checks are complete for the findings below; this does not certify every route, absence of P0/P1, Production security, or pivot launch readiness. Production was not patched. No real member data, account, email delivery, Live KYC or paid AI was used.

Production alias readback: `unstandard.app` → `dpl_BvmGTnKqyuxQyZ6Aut6xwJPsk16p`, READY, source `f5b3843494e6cfb6a87ef21339243e68d28151b9`. Main `30d0c78ee19d652fed2bedcae7271931f8f04b31` is an ancestor, 114 commits behind along Production ancestry. Production equals branch `feat/mobile-editorial-20261105`; audit PR #97 deliberately targets that branch. Do not retarget to main without reconciling the existing 237-file deployment delta.

PR92 remains Draft/open at da5f79e…; its head itself is not an ancestor claim. Production contains its application changes through separate earlier commits, not necessarily its latest operational gate additions. PR95 remains open at 8e4f403… against stale main; do not copy its manifest/lock wholesale. PR96 remains Draft/open, but its head f14e53a… is an ancestor of Production. GitHub merge status is not deployment provenance.

## Architecture and attack surface

37 API route files and 350 TypeScript files were inventoried. `prepivot-inventory.json` records literal import edges and environment variable **names**, not values. This is a static inventory, not a complete call graph or proof that arbitrary dynamic imports are unused.

| Flow | Entry → validation/authentication → authorization → storage/response |
|---|---|
| Signup/login/reset/delete | auth catch-all → Better Auth hooks/password/invite tickets → signed proof/reservation/finalization → Drizzle auth tables; sessions cascade on user deletion |
| Profile basics | profile API → session, schema, origin → server user.id → locked profile + identity rows; unchanged save preserves completed identity |
| Private profile/unlock | private/unlock APIs → session + input → viewerUserId, introduction pair and unlock predicates → private data or privateJson failure |
| Messaging | message API → actor + bounded JSON + message schema/rate limit → conversation membership/intro and block policy → transactional message repository |
| Reports | reports API → session, bounded JSON, actor validation/rate limit → server reporterUserId → ReportsRepository; old browser/memory buffers removed |
| Onboarding | API or server action → session + validation/rate limit → server user.id → answers repository and heuristic evaluation |
| Didit | webhook → bounded raw bytes, freshness/signature/schema/environment/workflow → request/session/vendor binding → durable completion signal; canonical lookup and purge via service |
| Waitlist/acquisition | API → schema/allowlisted UTM/rate limit → capability hashes and acceptance receipts → waitlist + aggregate counters; browser cannot submit server conversion names |
| Support/operator | session or dedicated operator token → bounded scope/policy → requester ownership or operator capability → support records/audit events |
| Consent/erasure | server-selected user + consent versions → database constraints and deletion hooks → cascade plus provider-purge outbox; actual external purge not tested here |
| Migration/build | explicit migration guard → environment/target checks → separate explicit invocation; build does not migrate |

Code-reviewed ownership anchors: profile-basics repository predicates use server userId; private-profile lookup checks viewer unlock and introduction authorization before reading private data; message repository receives authenticated viewerUserId. This is sampled review, not execution of A/B authorization for every route. No client-provided Depth result grants database unlock; DB unlock service persists its own evaluation. Existing heuristic labels are not psychological measurements.

## Security findings register

| ID | Severity/confidence | Evidence, condition and impact | Change/result | Remaining limit |
|---|---|---|---|---|
| SEC-01 | P1 / high dependency applicability | next16.3.8 falls in GHSA-p3m5-59mp-jv5r; App Router has `use server` actions; malformed action requests can cause DoS | next/eslint-config-next16.4.2; typecheck, tests and build pass; production dependency audit0 | Production still runs old source; no exploit attempted |
| SEC-02 | P1 / high code evidence | opencode workflow accepted any comment containing /oc and exposed paid AI credential + OIDC to mutable action | require comment author_association OWNER before running | default-branch workflow remains old until separately reviewed integration; action @latest still mutable; no paid call made |
| SEC-03 | P2 / high | webhook clones and fully buffers raw body **before** 256KiB guard; advertised limit did not bound reads | single stream reader cancels excess and supplies identical bytes to HMAC/JSON; boundary tests pass | infrastructure maximum and actual provider headers not exercised |
| SEC-04 | P2 / high missing controls, conditional CSRF exploit | reports/messages/unlock/onboarding APIs parsed unrestricted JSON without explicit Origin check | strict JSON +16KiB bounds; browser-facing Host Origin check; browser JSON clients compatible in source | sibling-origin attacker/cookie exploit not demonstrated; Preview browser test not run |
| SEC-05 | P2 / high | live onboarding server action persisted answers without API rate limiter | same onboardingAnswer scope + authenticated user.id in action; storage failures propagate closed | action-level exhaustion test not executed |
| SEC-06 | P2 / advisory exposure, exploit unproven | zod3 affected by GHSA-mrhx-c7xc-m3w5 constrained collection memory issue | zod4.6.7; full suite/typecheck/build pass | major-version provider payload compatibility only fixture-tested |
| SEC-07 | P2 / metadata confirmed, app connection unknown | metadata connection neondb_owner has CREATE ROLE/DB, BYPASSRLS; public tables owned by it, RLS false | read-only finding; no role change | connector role is not proof of runtime DATABASE_URL role; separately inspect then provision least privilege under explicit operations change |

Other Next audit notices: GHSA-2464-fhr4-w9xw Image Optimization RCE has sharp>=0.35.5 mitigation already present; no `use cache` typed-array function was found for GHSA-673q-mjm6-r5xr. Do not label those as proven exploitable. Update covers their affected version ranges nevertheless.

Sources: https://github.com/advisories/GHSA-p3m5-59mp-jv5r ; https://github.com/advisories/GHSA-2464-fhr4-w9xw ; https://github.com/advisories/GHSA-673q-mjm6-r5xr ; https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 . npm audit results are time-specific, not a proof against unknown vulnerabilities.

## Technical debt register and remediation log

| Asset | Decision | Evidence/action |
|---|---|---|
| lib/api/report-store.ts + lib/server/report-store.server.ts | REMOVE | no remaining code references in repository search; old manual checklist corrected; real reports repository preserved |
| Raw webhook double read | CONSOLIDATE | one bounded byte reader, no request.clone full buffering; signature bytes preserved |
| Request JSON handling | REPAIR | four mutation APIs reuse one bounded parser and existing origin policy |
| Onboarding action/API policy drift | REPAIR | action now consumes same scope/subject; storage business logic still duplicated; larger consolidation deferred |
| CI base filters | REPAIR | include Production-matching feature branch so audit PR gets gates after workflow integration |
| OpenCode | REPAIR / residual QUARANTINE candidate | owner-only trigger; mutable third-party action remains maintenance risk; no activation during audit |
| Mock auth/unlock/Depth | QUARANTINE | dev-only runtime boundaries preserved; no production AI/reveal/matching activation |
| Persistence repository boundary/privateJson | PRESERVE | DB path remains canonical; generic errors and private response policy preserved |
| Cyclic imports / unused packages | UNRESOLVED inventory | literal edge map supplied; no complete cycle or package reachability proof, no speculative deletion |
| Full tooling audit | KEEP pending narrow follow-up | 7 moderate entries in minimatch/typescript-eslint tooling chain; production0, high0, critical0; no broad tooling upgrade |
| Historical credentials | PRESERVE caution | pattern scan1661 history blobs found only placeholder DB URLs; limited scanner is not a full secret audit |

Minimal changes affect three legacy cleanup files plus API/helper/action/workflows/dependency versions and new tests. No DB schema change. Rollback: review a revert of the audit commits on a new branch; never reset/force-push main. Reverting security changes restores the documented exposure. Production already remains at its original SHA.

## Regression evidence

Runtime: Node24.22.1, Linux, npm ci --ignore-scripts baseline. Source baseline f5b3843; local cleanup commit92610e4 has same tree as GitHub4203d091. Subsequent checks run on the final uncommitted source tree represented by the next audit commit.

| Test | Expected | Actual |
|---|---|---|
| npm run check | lint/typecheck/tests/build succeed | PASS,410 tests,0 failures; Next16.4.2 build succeeds |
| New request-boundary tests | cancel excess stream, preserve HMAC bytes, exact limit, UTF8/JSON/media type rejection, origin rejection, proxy-host compatibility | PASS5/5; independent reviewer reran5/5 |
| Existing identity tests | signed envelope binding, repeated/completed status behavior and failure/purge fixtures | PASS as part of410; mocked/unit scope, no Live Didit |
| guard:boundaries | no prohibited client/server crossing in guard inventory | PASS |
| guard:no-legacy-backend | no active legacy backend in guard inventory | PASS |
| npm audit --omit=dev | no known production dependency advisories | PASS0 |
| npm audit (all) | record every finding |7 moderate tooling entries;0 high/critical; command exits1 |
| Real isolated DB migration/integration/auth | exercise actual transactions and A/B deletion/session behavior | PENDING — see final execution appendix |
| Production real-user/Live provider tests | outside authorized scope | NOT_RUN deliberately |

The 410 total is new execution, not the old405 record. Helper tests assert observable cancellation/bytes/results rather than source spelling. Route/DB end-to-end and actual Vercel headers remain separate evidence. No test assertions or security guards were weakened.

## Independent adversarial review

A separate agent inspected final diff, legacy references, raw HMAC preservation and onboarding limiter. It found internal URL/public host regression risk; that was corrected and a regression test added. It separately executed the five new tests successfully and found no additional confirmed blocking defect in the inspected diff. This is not complete independent certification. Preview headers, actual supplier payloads, database integration and runtime credential role remain outside its executed scope.

## Pivot reuse matrix

Reference PDF v0.3 was read: target is private conversation-preparation notes; local AI means cloud self-hosted inference. New implementation is not authorized here.

| Module/data | Before → after | Reason/conditions |
|---|---|---|
| Button/TextInput/TextArea/FieldError | A→A | presentation-only; adapt copy/accessibility context |
| Design tokens | B→B | keep selected visual tokens; product-specific layouts separate |
| privateJson | A→A | private response policy reusable; route must still authorize |
| UTM sanitizer | B→B | reuse allowlist approach; replace campaign/channel vocabulary |
| Bounded body reader | B→A within tested input contract | stream cancel and raw bytes preserved; choose product limits |
| DB server-only pattern | B→B | use new schema, empty DB and separate runtime/migration roles |
| Rate limiting | B→B | atomic UPSERT pattern; independent secret/policies; trust-boundary validation still needed |
| Migration guards | B→B | explicit invocation useful; replace heuristic target checks with verified project identity |
| Tests/CI | B→B | gate templates useful; product-specific fixtures and base filters must change |
| Authentication/onboarding/consent/deletion | C→C | invite/KYC lifecycle coupled; redesign new identity, consent, retention/purge contracts |
| New private note/result persistence | D→D | create purpose-specific owner authorization/storage; reports means abuse reports |
| Legacy report-store | X→removed | browser/memory buffers unsuitable for authoritative persistence |
| Old users/sessions/DB/secrets/consents | X→X | no automatic transfer or inferred purpose consent |
| Depth heuristic/labels/matching | X→X for psychology | no psychological validity; no reactivation of dormant AI service |

## Founder handoff

Actual changes fix bounded input processing, workflow trigger authorization, alternate-path rate limiting and known dependency exposure; remove two unused report buffers. Review PR97 and this report. Existing account/safety/consent/report functions were preserved in source and existing suite; full deployed behavior is not certified. Runtime role separation, mutable workflow pinning, tooling moderate advisories and unexecuted deployment checks remain recorded risks. Any Production integration/deployment requires a separate decision under the existing prohibition. The new synthetic test project is `raspy-art-18056978` (empty at creation, no clone), compute0.25CU with300s suspension; it is not a new pivot environment.

## PR95 package-by-package disposition

Comparison is against actual Production, not PR95's older base. Next16.4.2 was selectively applied and paired with eslint-config-next16.4.2. Zod4.6.7 is a separate current advisory repair absent from PR95.

| PR95 manifest candidate | Decision for audit |
|---|---|
| better-auth1.7.7→1.7.12 | defer; current audit reports no advisory; auth lifecycle change requires separate candidate tests, not claimed compatible |
| React/ReactDOM19.3.0→19.3.1 | defer; no current production advisory; paired upgrade not required for selected Next build |
| Drizzle0.45.3→0.45.4 | defer; do not couple transaction adapter update to this fix |
| react-query5.104.0→5.104.5, react-hook-form7.89→7.90, @types/ws8.18.1→8.18.2 | defer unrelated updates; no compatibility claim |
| @hookform/resolvers5.9.1→5.0.1 | reject stale manifest regression |
| eslint-config-next16.3.8→16.2.12 | reject mismatch/regression; use16.4.2 with Next |
| remove local braces + override protections | reject; patched vendored path and current overrides preserved |
| sharp0.35.5→0.35.3 | reject mitigation regression |
| js-yaml4.3.2→4.3.1 / brace-expansion override changes | reject stale mitigation rewrite |

PR95 must not be merged wholesale into the deployed lineage on the strength of this audit. Only the explicitly selected versions received current compatibility checks.
