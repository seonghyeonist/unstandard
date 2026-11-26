# UNSTANDARD B2C P2 재개 프롬프트

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
