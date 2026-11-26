# P2 진단 검증 매트릭스 · 2026-11-26 KST

| 검증 항목 | 기대 결과 | 실제 결과 | 증거 |
| --- | --- | --- | --- |
| 기존 Checkout 대조 | 종료 상태, 무주문 또는 전액 환불 | **BLOCKED** · 최신 Checkout Open, 시도 0건, 주문 0건 | [Polar Checkout](https://sandbox.polar.sh/dashboard/unstandard/sales/checkouts/d0aafaf7-4b83-4035-8b2f-10196d50a367) |
| HTTPS, 카탈로그, Checkout 생성 | 접근 게이트·매핑 검증 및 HTTP 201 | **PASS** · 기존 최신 실행 | [Actions](https://github.com/seonghyeonist/unstandard/actions/runs/45755155609/job/139692211031) |
| 요청/폼/로그 합성 검증 | 미분류·실패·422·프레임·공개 검증 상태·비밀 제거 | **PASS** · 합성 단위 및 Chromium 시험 | `apps/b2c/tests/checkout-observation.test.mts`, `apps/b2c/scripts/test-checkout-observation-browser.mts` |
| 로컬 회귀 | B2C check, PostgreSQL 17 통합 및 Alpha check | **PASS** · 단위 14개, 통합 12개, Alpha 405개 및 빌드 | `npm run check`, `npm run test:db` |
| 실제 Hosted Checkout 공개 카드 필드 신호 | 잘못된 값에서 invalid, 유효한 값에서 exact match 및 공개 유효성 | **PASS** · 번호·만료일·보안코드 3/3. 빈 필드에서도 aria false가 관측됨 | [읽기 전용 Hosted Checkout](https://github.com/seonghyeonist/unstandard/actions/runs/45767429114/job/139731613423) |
| 실제 결제 승인·순액·세금·총액 | 동일 Checkout의 단일 paid 주문 | **UNVERIFIED** | 공급자 주문과 앱 주문 매핑 필요 |
| 서명·원장·구매자 접근 | 서명 이벤트와 원장 대조, 구매자 카드 200 및 타 세션 차단 | **UNVERIFIED** | 실제 Polar 이벤트와 격리 DB |
| 실제 전액 환불·철회 | 동일 주문과 세금 포함 전액 성공, 기존 세션 read 차단 | **UNVERIFIED** | 실제 환불 이벤트와 동일 세션 |
| 새 결제·환불·배포 | 각각 0건 | **PASS** | 이번 실행 기록 |
