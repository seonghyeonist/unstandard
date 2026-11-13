# UNSTANDARD pre-pivot audit — 2026-11-13 KST

## Verdict and scope

**CONDITIONAL PASS for the corrected audit branch. Current Production/default-main controls remain FAIL against the confirmed P1 findings until separately approved integration.** Source fixes and local regression checks are complete for the findings below; this does not certify every route, absence of P0/P1, Production security, or pivot launch readiness. Production was not patched. No real member data, account, email delivery, Live KYC or paid AI was used.

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
| Cyclic imports / unused packages | PRESERVE / investigate | one static SCC spans auth/server/profile bootstrap; reverse links in profile bootstrap and reporter-nickname are type-only, so this graph is not evidence of a runtime cycle. lucide-react has no literal reference but full reachability not proven; no speculative deletion |
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
| Real isolated DB migration/integration/auth | exercise actual transactions and A/B deletion/session behavior | Migration PASS; original runner29/31 with2 connection failures; direct persistence retry16/16; five auth scenarios PASS; rate concurrency PASS — see final appendix |
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


## Production schema readback (metadata only)

2026-11-13 read-only catalog queries confirmed public sessions.user_id references users ON DELETE CASCADE; account/profile/private/answer/evaluation/message/legal/support/unlock relationships have the documented cascade constraints. Invites and verification consumed_by_user_id use SET NULL. Catalog includes users_delete_linked_residuals BEFORE DELETE and identity_verifications_queue_provider_purge AFTER DELETE triggers, plus alpha capacity INSERT/UPDATE guard. This proves deployed constraint/trigger presence, not successful erasure of any real record. No user table rows or secrets were selected.


## Confirmed remote checks

Commit0adc15a1d9b90392260208e9669b62f76936f290: CI#286 SUCCESS (https://github.com/seonghyeonist/unstandard/actions/runs/43371850766), Rebuild CI#226 SUCCESS (https://github.com/seonghyeonist/unstandard/actions/runs/43371850783). Subsequent report-only edits do not change the tested runtime tree. The local DB runner begins from local HEAD92610e4 with the corresponding audited runtime edits present; its recorded HEAD alone is not a clean-checkout attestation. The code/tree comparison is documented rather than silently labelling that local run as a clean remote SHA run.


## Remediation code locations

|Finding|Current location|
|---|---|
|SEC-01|`package.json:49`|
|SEC-02|`.github/workflows/opencode.yml:12`|
|SEC-03|`app/api/identity/webhook/route.ts:39`|
|SEC-04|`app/api/reports/route.ts:26`|
|SEC-04|`app/api/messages/[profileId]/route.ts:61`|
|SEC-04|`app/api/answers/unlock/route.ts:49`|
|SEC-04|`app/api/onboarding/answer/route.ts:33`|
|SEC-05|`app/onboarding/actions.ts:38`|
|SEC-06|`package.json:56`|

## Database execution appendix — intermediate results retained

The first short deadline runs were interrupted and are not PASS. The subsequent full integration runner against the fresh synthetic project completed with **29/31 tests PASS, 2 FAIL**: all db-unlock3, invites10 and migration/seed2 passed; persistence14/16 passed. The two failures occurred while inserting synthetic fixture users, with `Connection terminated due to connection timeout`; assertions were not relaxed. Failure-path baseline restoration and pool cleanup passed. A direct-endpoint persistence retry is recorded separately, never substituted as a PASS for the failed full runner.

Actual successful cases include invite and capacity parallel-request controls, consume/finalize/profile fault rollback, user-isolated unlock/private profile access, self-unlock rejection, verified/withdrawal introduction gates, and synthetic deletion producing an opaque provider-purge queue row. The schema migration completed and17 migration-ledger entries were confirmed in the synthetic database.

Auth test startup initially refused the pooler endpoint, as designed. Direct endpoint attempts then exposed a test-driver origin/target mismatch (`localhost` vs `127.0.0.1`); native fetch ignored an attempted Host override. Final driver uses the same127.0.0.1 authority for connection, Origin and auth configuration. No runtime guard or assertion was weakened. New driver lint/typecheck passed; independent reviewer examined the correction.

Didit direct security scenario exited0:9 negative/replay conditions PASS and no identity/purge side effects; fixture/rate cleanup returned to zero. No Live provider call or real mail delivery was made. Remaining direct-auth/persistence/rate outcomes follow in the final appendix.


## Final code snapshot and operational boundary

Final runtime/test-harness source commit is9a00dd16ea611c76f77ca7f3f2f8216cfe141a6e. Source content for app/lib/scripts/package/workflows/tests was compared byte-for-byte with the fetched remote commit (git diff --exit-code succeeded after staging the new test). CI#287 SUCCESS (https://github.com/seonghyeonist/unstandard/actions/runs/43373875657) and Rebuild CI#227 SUCCESS (https://github.com/seonghyeonist/unstandard/actions/runs/43373877356). Final local npm run check again passed410tests, lint, typecheck and build after bounding the remaining waitlist POST and Preview-only session-import JSON readers. The native browser callers use application/json; existing field validation and Preview/operator guards remain in place. These final two routes were independently diff-reviewed; their end-to-end success/oversized rejection was not separately executed.

**Branch remediation is not operational remediation.** issue_comment workflows execute default-main configuration: the current main workflow still permits the old public comment trigger until reviewed integration. Production still runs the old Next version until separately approved deployment. These operational P1 exposures remain present. This audit did not alter default-main workflow settings, merge any PR or deploy Production. The verdict for the corrected audit branch must not be presented as a PASS for current Production.


## 창업자용 핵심 인계

1. **실제 확인한 결함:** 외부 댓글의 유료 AI 워크플로 실행 경로, 적용 가능한 Next Server Action DoS 권고, 웹훅의 제한 전 전체 본문 적재, 일부 API 입력 경계 누락, 온보딩의 우회 가능한 rate limit 경로다. 실제 회원을 공격하지 않았다.
2. **수정한 범위:** 감사 브랜치에서 워크플로 호출을 소유자로 제한하고, Next/Zod 수정 버전을 적용했다. 웹훅 원문 서명 바이트를 보존하는 제한 읽기와 API JSON 제한을 적용하고, 온보딩 두 진입점에 동일한 제한을 적용했다.
3. **제거·격리:** 사용되지 않는 신고용 sessionStorage/서버 메모리 버퍼 두 파일을 삭제했다. 현재 신고 DB 기능은 유지했다. 기존 mock/Depth/매칭을 새 상품에 활성화하지 않았다.
4. **정상 동작 근거:** 최종 로컬410개 테스트·lint·typecheck·build 및 GitHub CI287/Rebuild227 성공. 합성 DB의 잠금해제·초대 동시성·탈퇴·신고·저장소와 로컬 Next의 가입·로그인·차단·지원·삭제 검증 결과는 실행 부록에 기록한다. 최초 DB 전체 실행29/31과 연결 변경 후16/16 재검증을 서로 구분한다.
5. **남은 운영 위험:** 기본 main 워크플로와 Production은 구버전이므로 P1 운영 노출은 아직 남아 있다. 실제 앱 DB 연결 역할, Preview 프록시·브라우저 동작, 공급자 실제 헤더는 미검증이다. mutable OpenCode action 및 개발 도구 moderate7건도 별도 기록했다.
6. **피벗에 가져갈 후보:** UI 기본 요소, privateJson, 제한된 본문 읽기, allowlist 방식 UTM 처리. DB/rate limit/migration/CI 패턴은 새 프로젝트의 정책·역할·환경에 맞춰 수정해야 한다.
7. **가져가면 안 되는 자산:** 기존 회원 데이터·세션·키·DB·동의를 자동 재사용하면 안 된다. Depth 점수와 라벨을 심리 결과의 정답으로 바꾸거나 신고 테이블을 분석 결과 저장소로 전용해서도 안 된다.
8. **다음 운영 단계:** 감사 브랜치 수정안을 운영 계보에 어떻게 통합할지 검토하고, 별도 승인된 변경으로 main 워크플로와 Production에 반영해야 한다. 이번 작업에서는 병합·운영 배포·운영 데이터 변경을 하지 않았다.


## Final runtime verification appendix

- Direct persistence retry: **16/16 PASS**, including the two fixture-INSERT timeout failures in the original pooler run. Before/after users, profiles, invites and rate_limits all0; pools closed. Original whole runner remains **FAIL29/31**, not silently relabelled.
- Corrected-origin email-proof scenario: **PASS**, wrong code/relationship, expired, invalidated and replayed proof rejected; no unauthorized auth rows; fixtures and rate limits cleaned.
- Didit-security scenario: **PASS**,9 negative/replay conditions, no side effects; synthetic fixtures cleaned. Live provider deletion was not attempted.
- Profile-visibility scenario: **PASS**, signup/login/logout, profile no-op saves, onboarding, unverified visibility denial, block denying messaging, withdrawal reducing visibility; cleanup0.
- Support-lifecycle scenario: **PASS**, requester isolation, operator reply authorization, CSRF denial, audit records, concurrent replay200/409; missing/wrong delete password rejected; correct deletion, stale session denial, subsequent signin denial and cascade checks passed; cleanup0.
- Password-reset-delete scenario: **PASS**, old sessions revoked, old password rejected/new password accepted, reset-token replay rejected, logout DB session invalidated, password-authorized deletion cascades owned data; cleanup0.
- Dedicated rate-limit concurrency: **PASS**,30 simultaneous real consumeRateLimit(messageSend) calls on a random synthetic subject,20 allowed/10 denied/0 exceptions; stored counter30. Only that test HMAC row removed and zero verified, pool closed.

No assertion was removed or weakened. Initial short-deadline interruptions, rejected pooler startup, mismatched-origin failures and original connection failures remain separate historical results. No API request used a real member or real provider credential. Runtime tests used source matching remote9a00dd1; local git HEAD remained92610e4 with staged matching source rather than pretending to be a clean checkout.

Remaining limits: no actual Preview browser/proxy verification, no Live provider/real email, no runtime Production credential-role inspection, no complete dynamic-import/unused-package proof. The owner-gated OpenCode action still uses a mutable tag;7 moderate tooling advisory entries remain. These limits and current operational P1 exposure prevent a global PASS/security-clearance claim. No new pivot product or data migration was implemented.


## Final cleanup and immutable handoff

All29public application tables in the synthetic project were verified empty after tests;17 migration-ledger rows preserved. Temporary credential env file removed; pools/Next processes closed. Nineteen DB logs scanned with0Postgres-URI matches. Endpoint ep-still-wildflower-bd4dwj5r remains in the retained synthetic project at min=max0.25CU with300-second automatic suspension. No remote project, credential or Production resource was deleted. Final readback of unstandard.app still resolves to original READY Production dpl_BvmGTnKqyuxQyZ6Aut6xwJPsk16p/f5b3843494e6cfb6a87ef21339243e68d28151b9.

Sanitized evidence files are under docs/audit/evidence; the original failed whole integration and final passing component retries are both retained. A reader can reproduce unit boundaries with `node --import tsx --test tests/audit-request-boundary.test.ts`, all local gates with `npm run check`, and DB scenarios with the existing scripts against a separately verified empty test database and ephemeral test credentials. Credentials are deliberately not included. The small report-only follow-up commit does not change runtime9a00dd1.
