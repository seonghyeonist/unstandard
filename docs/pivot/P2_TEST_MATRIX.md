# UNSTANDARD B2C P2 검증 매트릭스

2026-11-20 KST. PASS는 실제 실행한 범위를 뜻한다.

| 계층 | 결과 | 증거 |
|---|---|---|
| B2C lint/typecheck/unit/build | PASS | `npm --prefix apps/b2c run check`. 단위 12/12, 정적 빌드 |
| P1·P2 PostgreSQL/HTTP | PASS | PostgreSQL 17.11 일회용 클러스터. P1·P2 두 migration을 두 번 실행, journal에는 각 1건. P1 5/5, P2 7/7 |
| Alpha | PASS | 루트 `npm run check`. lint/typecheck, 테스트 405/405, Next 빌드, 정적 페이지 39/39 |
| SDK·원문 스트림 | PASS | Paddle SDK 3.12.0. 원문 공백, 과거·미래 서명 시각, 두 목적지 비밀, 시스템의 USD 세전 대조, Web Request 어댑터 |
| 앱 의존성 | PASS | B2C npm audit 결과 취약점 0건 |
| 무료 영수증 Chromium 재검수 | PASS | Chromium Headless Shell 153.0.8010.0, 360×800 및 1440×1000 EN/KO·키보드·유효성·조작 중 네트워크 요청 0건. 시스템 Chromium의 AF_UNIX 오류 후 별도 헤드리스 바이너리로 재실행 |
| Vercel Node 번들과 로컬 실행 | PASS | @vercel/node 32.0.0에서 nodejs24.x 함수 생성. 생성된 번들을 실행해 Checkout 인증 401/200, 교차 서명 401, Simulator 200 확인 |
| 실제 Vercel HTTPS | BLOCKED | CLI build에 B2C 프로젝트 설정이 없고 원격 설치·배포는 미실행 |
| Paddle preflight/provision | BLOCKED | Sandbox 설정 키 없음. Sandbox 대시보드는 로그인 화면 |
| Paddle Webhook Simulator | BLOCKED | Sandbox 키·분리 Destination·HTTPS 경로 필요 |
| 실제 Sandbox Checkout·Refund | BLOCKED | 명시 실행 변수·연결 키·격리 Preview 및 읽기 가능한 전용 DB 필요 |
| 원격 worker·메일 | BLOCKED | 합성 sink 및 재시도 검증 PASS. 원격 실행 및 실제 전달 미검증 |

## 합성 결과

- 동일 키로 동시 주문 다섯 번을 보내도 거래 1건. 다른 브라우저에서 같은 키나 주문 ID로 소유권을 주장하면 404.
- 완료 1회와 중복 전달 5회. 원장 1행, 방 1행, 개인 카드 작업 1행. 증명 회전 전 쿠키는 거절되고 동시 구매자 세션 요청은 하나만 성공.
- 완료 이전 승인 환불은 방 생성 0건. 결제 후 전액 환불/분쟁은 세션 접근 410. 부분 환불은 검토 표식.
- 미결제 카드 401. 서명 누락·오래된 시각·원문 변경 401. 거래·가격·수량·통화·세전 단가 불일치 422 및 상태 동일. Origin 불일치 403.
- 지연 제약 트리거로 COMMIT 시점 실패. 503 응답과 이벤트·방·작업 롤백. 동일 이벤트 재시도 200.
- 복구 요청 응답은 이메일 존재 여부와 동일. 만료 15분, 동시 소비 1회, 환불 후 링크 철회. DB rate limit 장애 시 503과 신규 거래 0.
- 생성 응답 유실 후 대조에서 기존 거래를 복구. 별도 상류 읽기 장애에서 lease 재시도가 성공. P1 타 방·상대 카드 소유권 및 no-store, 14일 경계 회귀 확인.

## 발견한 실패와 수정

- Node 24의 기본 TS strip-only 모드에서 parameter properties가 실패했다. 명시적 필드로 교체 후 통과.
- B2C Vercel TS 진입점이 Alpha 타입 검사에 들어갔다. B2C 자체 tsconfig로 검사하고 루트 타입 검사에서 제외했다. 루트 ESLint 익명 export 경고도 제거했다.
- 첫 SDK fixture가 필수 가격 수량 객체를 생략했다. Paddle 형식의 min/max를 추가해 SDK 서명 테스트를 통과시켰다.
- Vercel TS 추적이 .mts를 .mjs로 내보내고 기존 import를 유지해 패키지 실행에서 실패했다. 함수 includeFiles로 Node 24가 실행하는 필요한 원본 .mts도 포함했고 생성한 번들을 재실행했다.
- Simulator는 공식 알림 fixture에서 플랫폼과 다른 ntfsimevt_ 이벤트 식별자를 사용한다. 출처별 ID와 서명을 검사한다.
- 원격 플랫폼의 path forwarding과 헤더 덮어쓰기, Paddle 실제 event, 멱등 설정의 API read-back 결과는 도구 및 자원 연결 후 확인한다.
