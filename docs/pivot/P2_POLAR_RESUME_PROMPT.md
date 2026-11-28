# Current restart point — 2026-11-28 KST

- Sandbox attempt [46130363217](https://github.com/seonghyeonist/unstandard/actions/runs/46130363217/job/140934303801) followed verified terminal reconciliation of the previous Checkout. App checkout creation returned 201, the Hosted Checkout loaded and the test-card fields passed public validation. The Pay automation call returned once. The page recorded no trusted click, no native form submit, and no classified confirmation request.
- The aborted POSTs before and after Pay matched Polar's `/ingest/…` telemetry proxy. The checkout diagnostics now exclude known telemetry from payment-submission failure classification. The reason the Pay activation did not lead to confirmation remains unverified.
- [Post-attempt read-only status](https://github.com/seonghyeonist/unstandard/actions/runs/46130734195/job/140935089174) at 18:30 KST found `1511018d-9a6b-4f05-b6d4-e62f82fa7053` open, with zero linked orders, attempts or pending payments. Scheduled expiry is **2026-11-29 18:27:43.715 KST**. Recheck this exact ID and reconcile full history and concurrent actions before any new rehearsal. Time alone cannot establish termination.
- Polar support received the latest ID and reproduction timeline; await Hosted Checkout/Stripe trace. Do not repeat the same browser submission. Use provider guidance and evidence to choose a materially different single-submit test. If an existing paid record appears, recover it instead of creating a second order.
- Latest read-only Hosted Checkout field inspection: [46130846626](https://github.com/seonghyeonist/unstandard/actions/runs/46130846626). Test does not call Pay and blocks outbound writes. It is a field probe, not a payment attempt.
- Temporary webhook disable and runner PostgreSQL removal confirmed. Tunnel shutdown was requested by the job and external endpoint disappearance was not independently checked. Payment, signed webhook, ledger, buyer access and unrelated-session denial, full tax-inclusive refund and revocation all remain unverified for a real paid transaction.

---

# Current restart point — 2026-11-27 KST, after credential cleanup

This section supersedes conflicting historical restart instructions below.

## Completed and retained
- PR #100, branch `pivot/b2c-v4-p2-paddle`, base `pivot/b2c-v4-p1-data-session`. Read current remote SHA first.
- Correct Polar Sandbox organization: `e9d6161a-1711-4571-837b-05996cc8bd43`; product: `903bf4e5-61c0-4fe0-9325-9364c8b52754`.
- Registered token: **UNSTANDARD P2 payment reconciliation read only v2**, only `payments:read` and `checkouts:read`, expires **2026-12-27**. It is already stored in GitHub Environment `p2-polar-sandbox`, Secret `B2C_POLAR_PAYMENT_READ_TOKEN`. Use the environment injection; do not fetch, print, ask the user to copy, or reissue the secret.
- The first token without the `v2` suffix was exposed in a tool screen-state output during reauthentication. With explicit user approval it has now been permanently revoked. A fresh provider token list confirms its absence and retention of v2 and the four pre-existing tokens. Never reuse the exposed value or revoke v2 as cleanup.
- Payment-history 403 is resolved. Exact ID/org/product validation passed. At 2026-11-27 19:50:13 KST, Checkout below was open, linked order absent, 11 scoped Checkouts, 0 orders, 1 unresolved Checkout, 0 payment attempts, 0 pending org payments and 0 unresolved payments. `ready_for_rehearsal=false`.
- SHA `00995a296ef0165387be2ae1d66668d160d5e9a2`, run `45985383049`: checks `140459546369` PASS; status `140459546378` PASS. Lint, typecheck, build, 21 unit, 12 PG integration, Chromium and Docker build/smoke passed. This cleanup commit requests a fresh read-only status and checks; verify its final results directly.
- Added pre-Pay main-frame write preservation. The original log includes a pre-Pay Polar POST that also aborted after 3 seconds. Request roles and cancellation cause remain unknown. Synthetic comparison shows passive response-body loss during immediate app navigation; retain the exact one-time app orders proxy.
- Support draft `r-3105449313664746486` saved and updated, **not sent**. No new Checkout, Pay, refund, deployment or additional spending in the credential recovery/cleanup work.

## Remaining work, in required order
1. **Actual terminal reconciliation is still blocking.** Prior Checkout: `76e2d82a-a4eb-4a96-bc07-c938fb373d59`. Recorded expiry: **2026-11-28 13:55:32.313 KST**. Expiry passing is not proof of termination. Query exact Checkout and all scoped Checkout/order/refund/payment pages, verify correct org/product, no pending/unknown payment, unresolved order, duplicates or competing rehearsal.
2. Use the current workflow's read-only commit selection first: exact independent `Prior-Checkout: 76e2d82a-a4eb-4a96-bc07-c938fb373d59` line and final `P2-Polar-Sandbox: status` line. Existing status runs can be reused only after validating their source SHA and actual attempt. Do not rerun an old failed experiment and mistake that result for current code.
3. Only when terminal reconciliation, complete read access, latest code checks, and concurrency gates all pass, execute one controlled Sandbox rehearsal with the exact prior ID and final `P2-Polar-Sandbox: run`. Pay exactly once. No guard removal and no inference that an API failure means zero records.
4. In that same real Sandbox transaction verify: app order → Hosted Checkout → paid provider order → USD 899 cents before tax / quantity 1 / tax and total → actual signed paid webhook → DB paid ledger → buyer card 200 → unrelated-session denial → full refund including tax → actual signed refund webhook → refunded ledger → revocation for the original buyer session → verified cleanup of temporary webhook, tunnel and disposable DB. A 202 response is not card-read completion; use a synthetic P3 card only after real paid evidence and label it.
5. If payment succeeds but a later step fails, recover that existing transaction; do not create another order. If the unclassified POST abort repeats, stop identical resubmissions and correlate redacted request IDs/path/header-presence with navigation/closure and provider payment state. Obtain Polar server-side evidence through the existing support draft; sending the draft still requires explicit authorization.
6. Update PR #100 and evidence with exact SHA, run/job/attempt, real transaction results and cleanup. Until all same-transaction stages pass, P2 remains PARTIAL PASS / BLOCKED.

## Boundaries
Additional spending $0. No main/Alpha/Production/DNS/Polar Live/customer DB changes or merge. Credentials already exist; preserve least privilege and do not expose them. The user's authorization covers safe P2 technical execution; obey actual authentication requirements and safety gates.

---

## Historical restart text (superseded where conflicting)

## Mandate v2 재개 기준

[최신 대조와 절차](P2_AUTONOMOUS_EXECUTION_20261127.md). 11월 27일 14:18:47 KST 기준 대상 Checkout Open, 연결 주문 없음, Payment Attempts API 403. 기존 Checkout의 종료와 동일 Sandbox 조직의 `payments:read` 조회와 정확한 Checkout 소유 범위가 모두 확인된 뒤에만 후속 결제 리허설을 실행한다. 상태·결제 표식에는 정확한 `Prior-Checkout:`도 포함한다.

## 2026-11-27 KST 최신 재개 기준

[최신 인수인계와 실행 프롬프트](P2_AGENT_HANDOFF_20261127.md). 새 Checkout `76e2d82a-a4eb-4a96-bc07-c938fb373d59`의 API 상태는 `open`, 무주문이다. 공급자 만료 예정 2026-11-28 13:55:32.313 KST 이후 동일 ID를 재대조한다. [실제 리허설의 결제 직후 증거](https://github.com/seonghyeonist/unstandard/actions/runs/45942446362/job/140319790558)와 [새 거래의 상태 조회](https://github.com/seonghyeonist/unstandard/actions/runs/45942956882/job/140321166059)를 기준으로 재개한다.

# UNSTANDARD B2C P2 재개 프롬프트

## 2026-11-26 15:20 KST Hosted Checkout 실측

- [기존 Checkout 읽기 전용 실측](https://github.com/seonghyeonist/unstandard/actions/runs/45767429114/job/139731613423)에서 Checkout `d0aafaf7-4b83-4035-8b2f-10196d50a367`은 검사 전후 `open`, 연결 주문 없음, `ready_for_rehearsal=false`였다. Polar API의 만료 예정은 2026-11-27 13:29:17.454 KST다. Sandbox 대시보드 Payment Attempts에 표시된 항목은 0건이다.
- 실제 Hosted Checkout의 카드번호·만료일·보안코드 세 필드 모두 비어 있을 때 `aria-invalid="false"`였다. 형식·유효 기간이 잘못된 입력은 입력값이 화면에 그대로 반영된 상태에서 모두 `true`로 바뀌었고, 올바른 테스트 값과 blur 이후에는 모두 `false`로 돌아왔다.
- 새 리허설은 Pay 직전 세 필드의 기대값과 공개 유효성 신호를 함께 확인한다. 읽기 전용 실측은 비읽기 요청을 가로챘으며 Pay 클릭 0회였다. 청구 정보 제출 및 Polar 승인 경로는 별도 검증 대상이다.
- 만료 예정 이후 새 결제보다 먼저 상태 조회를 실행하고 동일 ID의 공급자 종료 상태, 연결 주문, Payment Attempts 및 진행 중인 실행을 다시 대조한다. 새 Checkout에는 제출 전 필드·폼·HTTPS·웹훅 및 격리 DB 검사를 적용한다. 진행 중이거나 불명확한 거래가 있으면 추가 제출을 하지 않는다.

## 2026-11-26 KST 진단 개선 및 재개 보류

- [장애 조사](P2_ROOT_CAUSE_REPORT.md)와 [진단 매트릭스](P2_DIAGNOSTIC_MATRIX.md)에 실행 비교 및 검증 근거를 기록했다.
- 최신 Checkout `d0aafaf7-4b83-4035-8b2f-10196d50a367`은 Polar에서 Open, Payment Attempts 0건, Orders 0건으로 확인했다. 이전 `expired` 결과로 대체할 수 없다.
- 신규 결제·환불·배포 0건. 실제 결제 승인부터 접근 철회까지는 미검증이다.

재개 시 PR 최신 SHA와 진행 중인 잡을 다시 조회한다. 먼저 읽기 전용 상태 조회로 Checkout ID, 공급자 만료 시각과 연결 주문을 대조하고 대시보드에서 Payment Attempts 및 미대조 주문을 확인한다. Open·Confirmed·진행 중 시도·불일치 발생 시 결제를 보류한다. 기존 마지막 결제 실행은 `45755155609` / `60cfe79`이다. 진단이 적용된 SHA의 CI, 비결제 폼 관측, Sandbox 카탈로그·임시 HTTPS·격리 DB, 중복 방지와 정리 경로가 모두 확인된 후에만 Pay 1회가 허용된다.

2026-11-23 KST · `pivot/b2c-v4-p2-paddle` · [Draft PR #100](https://github.com/seonghyeonist/unstandard/pull/100)

## 단일 재개 지점

12:44 KST의 기존 open Sandbox Checkout 상세와 Orders부터 재대조한다. 신규 주문 생성 전에 통제된 헤디드 Chromium에서 Stripe iframe의 폼 완료·검증 상태 및 Polar/Stripe 확인 요청을 확인할 수 있는 진단을 준비한다. 기존 Checkout에서 원래 앱 구매자 세션은 종료됐으므로 결제는 제출하지 않는다. 실패 원인 또는 안전한 수정이 확보된 뒤 새 앱 Checkout으로 같은 세션 E2E를 한 번 실행한다.

## 현재 인수 상태

- 검증 소스 `5e470ca856b5740118b7d286151d550b97c3a467`, [Run 45107543288 Attempt 1](https://github.com/seonghyeonist/unstandard/actions/runs/45107543288/attempts/1). 그 뒤 Draft에 기록된 문서 커밋과 실행 소스를 구별한다.
- HTTPS는 할당 후 약 61초에 연결됐다. 카탈로그, Basic 401, 앱 페이지 200, 미서명 웹훅 401, 미결제 카드 401, Checkout 201, 구매자 정보 사전 입력, 카드 입력, 결제 버튼 클릭까지 확인했다.
- 버튼 클릭 후 `open` / `absent` / `pay_button_available`. Stripe·Polar 확인 응답은 관측되지 않았고 대시보드상 결제 시도 및 주문은 0건이다. 90초 뒤 `sandbox_checkout_not_confirmed`.
- 최종 Polar Checkout 상세는 `Open`, $8.99 상품, Payment Attempts 0건이었다. 같은 시점 Orders는 전체 기간·전 상태 0건이었다. 임시 웹훅 비활성화와 러너 DB 컨테이너 정리를 확인했다.
- 로컬 `b2c:test:all` PASS. lint·typecheck·build와 단위 12/12, 일회용 PG17 migration 2회 및 통합 12/12. 새 GitHub 리허설은 실제 공급자 승인과 기존 구매자 세션까지 확인해야 한다.
- Vercel 프로젝트는 존재하지만 API에서 이름/정확한 ID 404, 배포 목록 403. 브라우저상 Hobby, Git 미연결, Root Directory 빈 값, Node 26.x다. 지속 HTTPS 배포는 허용 호스트와 $0 근거가 확인된 뒤 진행한다.
- Neon Launch 전용 프로젝트의 compute와 DB는 식별됐고 idle이다. 과금 없는 remote migration 근거가 생길 때까지 로컬 격리 PG17을 사용한다.

## 실행 경계

[Draft PR #100](https://github.com/seonghyeonist/unstandard/pull/100)의 현재 HEAD와 base를 다시 확인한다. 브랜치는 `pivot/b2c-v4-p2-paddle`이며 활성 공급자는 Polar Sandbox다. GitHub Environment `p2-polar-sandbox`의 기존 범위에서 런타임·목적지 설정·환불 토큰을 분리해 사용한다. 신용카드 실거래, Live, Alpha·Production·main, 병합, 유료 자원은 범위 밖이다. 환경 비밀값, 세션 쿠키, 결제 주소, Checkout 링크, 터널 URL, 원문 웹훅은 기록에 남기지 않는다.

## 실행 규칙

1. 마지막 Actions에서 앱 주문 생성 시각을 확인한 뒤 Unstandard Polar Sandbox의 Checkouts / Orders / Payment Attempts를 대조한다. 보류·불명·이미 승인된 주문이 있으면 신규 Checkout 생성 전에 기존 주문을 해결한다. 폼 검증으로 결제 시도가 없었던 open Checkout은 공급자 확인과 종료된 원래 브라우저 증거를 남긴 뒤 다음 실행의 제한된 대조 기준으로 사용할 수 있다. Sandbox에 기존 paid 주문이 있을 경우 주문·환불 이력과 앱 귀속을 먼저 확인한다.
2. 첫 입구는 기존 공개 저장소의 표준 Ubuntu GitHub runner와 독립 PostgreSQL 17, 임시 HTTPS다. `.github/workflows/p2-polar-sandbox.yml`의 정확한 브랜치, Environment, 변경 트리거를 확인한다. 같은 주문의 외부 작업은 순차 실행한다.
3. 앱 Checkout 201과 공급자 Checkout ID·내부 주문 ID를 대조한다. 상품 1개, 세전 USD 899센트, 할인 0, 세금과 총액을 확정한다. 공식 hosted UI에서 정상 입력·제출과 주문 paid를 별도로 확인한다. 실제 서명 이벤트 처리 후 원래 브라우저의 카드 API를 200/202로 확인한다.
4. 동일 주문의 기존 환불을 확인한 뒤 분리된 환불 토큰으로 전액 환불을 한 번만 요청한다. provider 최종 `succeeded`, 원금과 세금 전액, 서명된 환불 이벤트와 같은 구매자 세션의 카드 401/410을 확인한다. Basic 인증 실패, 세션 유실, 주소 또는 터널 오류는 철회로 판정하지 않는다. 이벤트 중복과 순서 역전은 합성 회귀에서 확인한다.
5. 임시 목적지 비활성화와 브라우저·터널·서버·DB 종료 증거를 수집한다. 자체 미처리 주문과 환불은 공급자에서 대조한다. 확인 항목만 Draft PR의 본문과 문서에 갱신한다.
6. Vercel Preview는 브라우저에서 확인한 기존 프로젝트 ID로 접근 범위를 복구하고, 이용약관과 $0 조건을 함께 충족할 때 검증한다. 두 조건 중 하나라도 막히면 독립적인 GitHub 실험을 계속한다. Launch 과금 조직의 Neon DB를 다시 깨우기 전 청구 없는 실행 근거를 확인한다.

[활성 Polar 런북](POLAR_SANDBOX_RUNBOOK.md) · [P2 인수인계](P2_HANDOFF.md)
