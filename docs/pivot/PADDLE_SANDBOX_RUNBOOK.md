# UNSTANDARD Paddle Sandbox 런북

이전 구현 기록. 현재 P2 검증은 [Polar Sandbox 런북](POLAR_SANDBOX_RUNBOOK.md)을 사용한다.

모든 Paddle 호출은 `https://sandbox-api.paddle.com`으로 고정한다. 연동은 합성 고객·공식 테스트 카드 전용이다.

| 범위 | 변수 |
|---|---|
| 전용 Preview/DB | `B2C_ORIGIN`, `B2C_DATABASE_URL`, `B2C_EXPECT_DB_HOST`, `B2C_PAYMENT_MODE=sandbox`, `B2C_SANDBOX_ACCESS_KEY` |
| Paddle 서버 | `B2C_PADDLE_API_KEY`, `B2C_PADDLE_PRICE_ID`, `B2C_PADDLE_WEBHOOK_SECRET`, `B2C_PADDLE_SIMULATOR_SECRET`, `B2C_PAYMENT_TOKEN_KEY` |
| 체크아웃 | `B2C_PADDLE_CLIENT_TOKEN`, `B2C_SANDBOX_TEST_EMAIL_DOMAIN`, `B2C_PADDLE_E2E_API_KEY`, 필요시 `B2C_BROWSER` |
| 설정 | `B2C_PADDLE_SETUP_API_KEY`, `B2C_PADDLE_SECRET_OUTPUT_FILE`, `B2C_PADDLE_ALLOW_ACCOUNT_SETTINGS`, 필요시 `B2C_PADDLE_EXPECT_PREVIOUS_CHECKOUT` |
| 작업 실행 | `B2C_SANDBOX_WRITE_CONFIRM`, `B2C_LOCAL_MAIL_SINK` |

## 격리와 설정 순서

1. Vercel의 새 B2C 전용 Preview에서 Root Directory를 `apps/b2c`로 설정한다. 무료 정적 출력에는 원래 CSP가 들어간다. 서버 결제/복구/카드 경로는 독립 Basic 인증을 사용하고 두 웹훅 URL만 인증을 제외한다. 두 웹훅 모두 Paddle 서명을 요구한다. 기존 Alpha Preview 보호는 유지한다. 별도 Preview의 HTTPS 경로에서 경로 전달, raw body, 신뢰 IP와 Basic 동작을 확인한다. [Vercel Node.js Runtime](https://vercel.com/docs/functions/runtimes/node-js) · [Forwarded headers](https://vercel.com/docs/headers/request-headers)
2. Neon의 빈 독립 DB `unstandard_b2c`를 지정하고 runtime/migrator 권한을 분리한다. 승인된 호스트를 정확히 지정한 뒤 `B2C_MIGRATE_CONFIRM=authorized-remote-b2c npm --prefix apps/b2c run db:migrate`로 적용한다. 적용은 빌드와 별개다.
3. 읽기 전용 preflight를 먼저 실행한다. Provision은 이름·소유 마커·결제 계약·목적지 URL을 기준으로 기존 설정을 재사용한다. 계정 단위 기본 링크와 자동 통화 전환은 영향 범위를 확인한다. 전용 계정의 통화 전환 변경에는 `B2C_PADDLE_ALLOW_ACCOUNT_SETTINGS=dedicated-b2c-sandbox`를 사용한다. 설정 변경 전 값을 남긴다. 새 리소스의 동시 Provision은 지원하지 않는다. [Paddle 2026-10-20 Account Settings 릴리스](https://developer.paddle.com/changelog/2026/account-settings-api/)
4. Provision은 신규 비공개 파일을 0600으로 만들고 API read-back에서 얻은 값으로 채운다. 파일은 저장소 밖에 둔다. 서버 비밀 관리자에 넣은 뒤 로컬 파일을 삭제한다. 콘솔에는 리소스 ID와 상태만 남긴다. Sandbox 클라이언트 토큰은 `test_` 접두사다. Basic key와 token key는 서로 다른 32바이트 난수다.
5. 개발 복구 메일은 0700의 로컬 sink 디렉터리와 0600 메시지 파일을 사용한다. Sandbox 구매·환불 메일은 합성 주소가 계정 도메인과 다를 경우 Paddle이 계정 주 이메일로 전달할 수 있으므로 허용 여부를 확인한다. [Paddle Sandbox 메일·테스트 카드·환불](https://developer.paddle.com/sdks/sandbox/)

## 명령

```bash
npm --prefix apps/b2c ci
npm --prefix apps/b2c run b2c:test:unit
npm --prefix apps/b2c run b2c:test:db
npm --prefix apps/b2c run b2c:test:payment:synthetic
npm --prefix apps/b2c run b2c:test:all
npm --prefix apps/b2c run b2c:paddle:preflight

B2C_SANDBOX_WRITE_CONFIRM=provision-b2c-sandbox npm --prefix apps/b2c run b2c:paddle:provision
B2C_SANDBOX_WRITE_CONFIRM=run-b2c-simulator npm --prefix apps/b2c run b2c:paddle:simulator
B2C_SANDBOX_WRITE_CONFIRM=checkout-b2c-sandbox npm --prefix apps/b2c run b2c:test:checkout:sandbox
B2C_SANDBOX_WRITE_CONFIRM=reconcile-b2c-sandbox npm --prefix apps/b2c run b2c:test:payment:reconcile
```

PostgreSQL 17 실행 파일을 PATH 또는 `B2C_PG_BIN`으로 지정한다. 집계 테스트는 로컬 전용이다. 명령은 JSON 요약과 0 PASS, 1 FAIL, 78 BLOCKED를 반환한다.

Simulator 명령은 설정 재사용, 실제 Simulator run, 완료 및 조정 이벤트의 순서·반복 전달과 HTTP 결과를 확인한다. 새 run은 별도 event ID를 만들 수 있다. 동일 event ID 재전송과 비정상 상품 계약 검사는 합성에서 검증한다. 공식 Simulator의 사용자 지정 EUR 이벤트는 422를 기대한다. 원격에서 이 응답을 관측하는 작업은 연결 후 실행한다. [Simulator Runs](https://developer.paddle.com/api-reference/simulation-runs/create-simulation-run/)

Checkout 자동화는 공식 테스트 카드만 사용한다. 실제 DOM/iframe 선택기 검증은 연결 후 가능하다. 보안 확인이나 폼 진행 조건에 막힌 경우 진행 지점과 BLOCKED를 기록한다. 승인 환불을 최대 12분 조회한 후 실제 권한 철회를 확인한다. P2 카드 API의 정상 상태는 202다.

권한 변경이 필요하면 새 Checkout부터 중지한다. 환불 및 기존 원장과 권한은 이전 검증된 배포로 이어간다. Sandbox 설정을 되돌릴 때 이전 기본 링크와 통화 설정을 복원하고 새 Destination 및 토큰을 비활성화/철회한다. 생성된 Sandbox 거래·환불의 공급자 정산 기록은 보존된다.
