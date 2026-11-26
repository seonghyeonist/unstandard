# P2 Polar Sandbox 장애 조사 · 2026-11-26 KST

**PARTIAL PASS / BLOCKED.** 13:29 KST에 생성된 [Checkout](https://sandbox.polar.sh/dashboard/unstandard/sales/checkouts/d0aafaf7-4b83-4035-8b2f-10196d50a367)은 대시보드에서 Open, Payment Attempts 0건이었다. [Sandbox Orders](https://sandbox.polar.sh/dashboard/unstandard/sales)는 0건을 표시했다. 정확한 만료 시각은 대시보드에서 확인하지 못했다. 연결 도구의 404는 대시보드에서 확인된 Checkout의 상태 판단에 사용하지 않았다.

## 조사 기준

- 원격 Draft PR #100 기준 HEAD `14dc57794eb2f19ea6d8abf625897a612f7a0f02`, base `pivot/b2c-v4-p1-data-session`. 최신 실패 SHA `60cfe79d3da3ab91a689a3966fb624869b1eef8b`와의 차이는 P2_HANDOFF.md 한 파일이었다.
- [11월 25일 리허설](https://github.com/seonghyeonist/unstandard/actions/runs/45532584590/job/138931495481)과 [11월 26일 리허설](https://github.com/seonghyeonist/unstandard/actions/runs/45755155609/job/139692211031)은 Pay 클릭 후 약 90초 동안 Open·무주문으로 끝났다. 최신 로그의 미분류 Polar 요청 `ERR_ABORTED`는 결제 확인 요청과 연결되지 않았다. 관측기가 놓친 요청 존재 여부는 여전히 미확정이다.
- [읽기 전용 3차 실행](https://github.com/seonghyeonist/unstandard/actions/runs/45535181380/attempts/3)의 만료 확인은 11월 25일 생성 Checkout에 해당한다. [별도 컨테이너 실패](https://github.com/seonghyeonist/unstandard/actions/runs/45533115108/job/138933189128)는 smoke 단계의 connection reset이며 결제 잡은 스킵됐다. [Render 배포](https://github.com/seonghyeonist/unstandard/actions/runs/45617379661/job/139216679258)는 SHA `0a935d1`을 검증했다.
- 최신 결제 잡은 러너의 PostgreSQL과 임시 HTTPS를 사용했다. 해당 실행에서 카탈로그 조회, HTTPS 및 앱 접근, Checkout HTTP 201, Hosted Checkout 진입은 통과했다. Render/Vercel/원격 Neon은 그 실행의 승인 전 경로 밖에 있었다.

## 가설과 관측 결과

| 가설 | 판별 증거 | 실제 관측 및 판정 |
| --- | --- | --- |
| H1 Stripe 입력 미완료 | 개별 카드 필드의 공개 검증 신호와 blur 이후 상태 | 숫자 일치와 blur만 입증. **UNRESOLVED** |
| H2 청구 정보 검증 실패 | 필수 필드의 공개 오류, 제공자 응답 | API fixture 적용과 일부 필드의 렌더링 통과. 제출 시 검증은 **UNRESOLVED** |
| H3 Pay 클릭과 제출 분리 | trusted click, native submit, JS 요청 상관관계 | Playwright 클릭 반환만 입증. **UNRESOLVED** |
| H4 JavaScript 또는 비동기 실패 | 첫 탐색부터 페이지·콘솔 오류와 응답 타임라인 | 늦게 등록한 기존 리스너의 page error 0만 확인. **UNRESOLVED** |
| H5 결제 요청 분류 누락 | Context 전체 요청과 허용된 메타데이터 | 기존의 좁은 POST 경로 분류 결함 **CONFIRMED**, 실제 결제 요청 누락 여부 **UNRESOLVED** |
| H6 리소스·iframe·브라우저·공급자 문제 | 초기 로드 실패, 프레임 전이, 상태 코드와 시간 | 미분류 Abort 한 건. **UNRESOLVED** |
| H7 Sandbox 상품·가격·설정 | 카탈로그·Checkout 매핑·제출 응답 | 조직/상품의 사전 조회와 매핑 통과. 제출 시 설정 거절 가능성 **UNRESOLVED** |
| H8 앱 생성과 공식 경로 차이 | 설정 필드 비교와 통제된 비교 검증 | 앱 Checkout 생성만 입증. **UNRESOLVED** |
| H9 러너 환경 특이성 | 동일한 진단을 갖춘 환경 간 비교 | 기존 두 번 모두 Actions/Xvfb. **UNRESOLVED** |

## 변경 후 검증

B2C check는 lint, typecheck, 단위 14개 및 build를 통과했다. 일회용 PostgreSQL 17에서 두 차례 migration과 통합 12개를 통과했다. Alpha check는 테스트 405개와 build를 통과했다. Chromium에서는 외부 전송이 없는 합성 route를 사용하여 초기 오류, 교차 출처 iframe, 필드 검증, 클릭·폼 이벤트, HTTP 422, 요청 중단 및 민감정보 제거를 검증했다. Docker smoke와 원격 CI는 이 변경의 GitHub Actions 실행에서 확인한다.

## 변경과 중단 기준

브라우저 Context 생성 직후 요청·응답·실패와 페이지·프레임 관측을 등록한다. 공개 필드 검증, 실제 DOM 클릭/폼 제출 신호, 미분류 write, 공급자 상태를 별도로 남긴다. SPA는 네이티브 submit 없이 요청할 수 있다. 공개 카드 검증 신호가 확인되지 않으면 Pay 전에 차단한다. 로그는 허용된 분류값, 타이밍, HTTP 상태만 포함한다.

상태 조회에는 Checkout ID와 생성·만료 시각이 포함된다. 기존 Checkout이 Open 또는 Confirmed인 동안 결제는 보류한다. 주문이 paid여도 카드 read가 입증되기 전 정상 E2E 환불 단계는 진행하지 않는다. 늦게 생긴 주문은 별도 대조한다.

현재 Stripe 필드의 공개 `aria-invalid="false"`가 양성 신호이며 실제 Hosted Checkout이 세 필드에 이를 제공하는지는 미검증이다. 확인되지 않으면 별도의 비결제 관측으로 신호를 검증할 때까지 재시도 조건이 충족되지 않는다.

공식 계약: [Polar Checkout 상태](https://polar.sh/docs/api-reference/checkouts/create-session), [Stripe 테스트 카드](https://docs.stripe.com/testing). SDK는 저장소 잠금 기준 `@polar-sh/sdk 1.3.2`, API namespace `2026-10`. Checkout 상태를 주문 paid로 해석하지 않는다. 금액은 프로젝트 계약에 맞춰 수량 1, USD 세전 899센트 및 세금·총액을 확인한다.
