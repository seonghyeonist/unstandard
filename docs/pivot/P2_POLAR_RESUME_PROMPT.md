# P2 Polar Sandbox 재개 프롬프트

너는 UNSTANDARD B2C P2의 결제 검증을 이어받는다. [Draft PR #100](https://github.com/seonghyeonist/unstandard/pull/100)의 최신 HEAD를 읽고 `apps/b2c`와 [Polar 런북](POLAR_SANDBOX_RUNBOOK.md)을 확인한다. 목표는 **앱이 생성한 USD 899센트 단건 주문 → Polar 서명 웹훅 → 구매자 세션 → 성공한 전액 환불 → 같은 세션의 카드 API 401 또는 410**을 검증하는 것이다.

## 실행 경계

- `pivot/b2c-v4-p2-paddle`은 PR #100의 작업 브랜치다. 이름은 기존 PR을 유지하기 위한 것이다. 실행에서는 Polar Sandbox만 사용한다.
- GitHub 환경 `p2-polar-sandbox`는 이 브랜치의 정확한 이름으로 제한되어 있다. 세 Sandbox 비밀은 런타임, 웹훅 등록, 테스트 환불로 분리해 저장했다. 만료 상태를 먼저 확인한 뒤 필요한 값만 해당 Environment에 주입한다.
- [원격 리허설 워크플로](../../.github/workflows/p2-polar-sandbox.yml)는 이 브랜치에서 워크플로 파일을 바꾼 push로 시작한다. 이전 실패가 일시적이고 주문이 생성되지 않았음을 확인한 경우 같은 GitHub run을 다시 실행할 수 있다. Checkout 이후 실패한 경우 기존 Sandbox 주문·환불 상태부터 대조한다.
- GitHub runner 내 PostgreSQL 17은 합성 데이터 전용이다. 임시 HTTPS 경로의 증거와 Vercel 및 Neon을 사용한 증거를 각각 기록한다. 예산은 Vercel 추가 비용 0달러다. Alpha, Live, Production, main은 범위 밖이다.
- 체크아웃과 카드 경로에는 Basic 인증을 적용한다. 웹훅은 원문과 Polar Standard Webhooks 서명을 검사한다. 종료 시 임시 목적지 비활성 및 터널 종료를 확인한다. 값, 쿠키, 서명, 이벤트 원문, 이메일, 임시 URL은 공개 로그·PR에 남기지 않는다.

## Vercel 전용 Preview

1. 사용자 브라우저에서 `unstandard` Hobby 팀의 `unstandard-b2c-p2` 프로젝트가 보였다. 연결 API는 프로젝트 ID와 팀 slug 양쪽에서 조회 404, 배포 목록 403이었다. 유효한 인증으로 같은 팀·프로젝트를 조회할 수 있어야 한다. 프로젝트 중복 생성은 피한다.
2. Hobby에서 비공개 결제 테스트가 허용되는지 서비스 근거를 확보한다. [Hobby Fair Use](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)에는 결제 관련 제한이 있다. 허용이 확인되면 별도 인증 세션에서 이 프로젝트의 `apps/b2c`, Node 24, Preview 후보를 검증한다. Git 연결이나 드롭 UI가 Production을 생성할 수 있는 상황이면 검증한 소스의 Preview 전용 배포 경로를 선택한다.
3. 안정적인 Preview HTTPS 주소와 프로젝트 보호 옵션을 확인한 뒤 Polar가 서명 웹훅 경로에 도달하도록 설정하고, 결제·카드의 Basic 인증은 유지한다. 기존 Preview에는 런타임 토큰 및 모드·조직 ID·상품 ID가 설정된 기록이 있다. 나머지 앱 origin, 서명 비밀, 앱 토큰 키, Basic 접근 키, 전용 Neon DSN·호스트는 Preview에 설정한다.
4. P2 전용 Neon의 승인된 runtime/migrator 역할을 분리한다. `B2C_EXPECT_DB_HOST`와 접속 호스트를 일치시킨 뒤 승인 명령으로 migration을 수행한다. 실제 Vercel HTTPS에서 E2E를 확인하기 전에는 Vercel PASS 판정을 보류한다.

## 증거 판정

GitHub Actions의 정확한 commit과 run, 카탈로그 검증, HTTPS 실제 확인, 웹훅 등록과 처리, Provider 주문, 구매자 카드 상태, 전액 환불 승인, 같은 세션 차단 및 임시 목적지 정리를 순서대로 기록한다. 공급자 또는 브라우저의 보안 차단이 표시되면 그 단계에서 멈추고 근거를 남긴다. 헤디드 검증이나 Polar 공식 릴레이를 사용하는 경우 전송 경로를 기록한다.

## 마지막으로 확인한 상태 · 2026-11-21 KST

- 실행 소스 `fd95dd8ee39827d85f6d76630bbf565feab056c5`. [정확한 워크플로 실행의 두 번째 시도](https://github.com/seonghyeonist/unstandard/actions/runs/44863696154/attempts/2).
- PASS 구간은 PostgreSQL 17 migration, Polar USD 899 카탈로그, 임시 외부 HTTPS 실제 응답, 웹훅 목적지 등록, Basic 인증과 미서명 웹훅 거절, 보호된 앱 체크아웃 200, 미결제 카드 401, 앱 주문과 Polar Checkout 생성 201, Polar Sandbox 결제창 열기, 공식 테스트 카드 제출이다.
- BLOCKED 구간은 `sandbox_checkout_not_confirmed`다. Polar의 해당 Checkout 주문을 90초 조회했지만 paid 상태를 확인하지 못했다. Sandbox Sales에서도 주문 표시가 없었다. 공급자의 구체적인 거절 사유는 관측되지 않았다. 실제 성공 주문의 서명 이벤트, 구매자 접근, 전액 환불, 동일 세션 철회는 미검증이다.
- 임시 웹훅은 비활성화됐고 터널은 종료됐다. Polar 대시보드에서 리허설 목적지들이 Disabled인 것을 확인했다. 원격 Neon은 migration을 수행하지 않은 별도 경로다.
- 재개할 때 바로 새 주문을 만들기 전에 마지막 Checkout의 상태와 Sales를 조회해 지연 승인 여부를 확인한다. 이미 결제됐다면 해당 주문을 대조한다. 여전히 미결제라면 통제된 헤디드 브라우저에서 앱을 통해 결제창을 열고 최종 제출 직후 표시되는 상태·오류를 확인한다. 주소·이메일·카드·토큰을 제외한 단계와 상태만 기록한다. 보안·사용자 확인 화면이 나타나면 서비스의 지시를 따른다.
- 임시 TLS가 다시 불안정하면 `temporary_https_transport_not_verified`와 `origin_and_gates`를 먼저 비교한다. 공식 Polar CLI 로컬 릴레이를 사용할 수 있으면 실제 Sandbox 결제 이벤트가 로컬에 전달되는 통합을 따로 검증한다. 그 결과를 Vercel 검증으로 합산하지 않는다.
