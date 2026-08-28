# 실명·본인 명의 휴대전화 인증 연동

작성: 2026-08-28 · 기존 Draft PR #80의 후속 작업

**ADAPTER_IMPLEMENTED / LIVE_AUTHENTICATION_BLOCKED / NOT_READY_FOR_PRODUCTION**

사용자는 실명과 휴대전화 소유 모두 인증하는 방식을 선택했다. 코드의 연동 대상은 PortOne V2 + 다날 휴대폰 본인인증이다. 유료 계약 체결·개인정보 이전·실제 인증문자 발송·Production 활성화를 진행하거나 승인받았다는 뜻은 아니다.

## 변경 범위

- 공식 `@portone/browser-sdk/v2` loader 0.1.9를 정확한 버전으로 추가. 기능 사용 가능 + 이용자 동의 + 버튼 클릭 이후에만 동적 import/호출한다. 이 패키지는 공식 CDN의 SDK를 로드하므로 npm 버전 고정이 CDN 런타임 고정을 뜻하지 않는다.
- 시작 API는 서버가 생성·저장한 UUID와 공개 store/channel 식별값만 반환한다. 임의 URL·추가 키·다른 요청 ID는 거절한다. 앱의 닉네임·이메일·성별·나이·이름·전화번호를 SDK customer/customData로 넘기지 않는다.
- PC SDK 응답 후 서버 완료 API 호출. 모바일 복귀 GET은 모든 쿼리 파라미터를 버리고 고정 `/profile-setup`으로 이동한다. GET에서 인증을 확정하지 않는다. 로그인한 사용자 자신의 pending 요청 ID를 DB에서 조회해 ‘인증 결과 확인’으로 재조회한다. URL·localStorage·sessionStorage의 ID를 권위 있는 정보로 쓰지 않는다.
- 서버는 고정 `https://api.portone.io/identity-verifications/{id}?storeId=...`를 API Secret으로 조회한다. 사용자 입력으로 API host를 바꾸거나 리다이렉트를 따라가지 않는다. no-store, 8초 fetch/body timeout, 실제 응답 64KiB 상한을 적용한다.
- canonical 응답의 `VERIFIED`, V2, LIVE, 정확한 channel key, `DANAL`, 동일 요청 ID, 인증된 이름 존재를 확인한다. 서비스에서 계정 소유권·프로필 revision·동의·만료·인증 시각을 재검사한다. 네트워크 왕복 중 만료되는 경우도 거절한다.
- 최소 증거만 repository로 넘긴다. 이름·전화번호·생년월일·CI/DI·pgRawResponse는 저장하지 않고 오류에 포함하지 않는다. 기존 migration/schema 변경 없음. 기본 프로필 조회에 본인 pending 요청 ID만 추가했다.
- 실패·취소·provider 오류를 UI에 원문 출력하지 않는다. provider 성공 화면만으로 verified를 만들거나 SMS-only/수동 승인으로 우회하지 않는다.

## 인증의 의미와 원문 처리

다날의 휴대폰 본인인증 완료는 본인 명의 휴대전화와 본인확인정보를 인증하는 절차다. 여기서 휴대전화 소유 확인은 이 절차의 성공을 뜻하며 법적 소유권에 관한 별도 증명이나 물리적 사용자를 완벽히 보장한다는 뜻은 아니다.

다날은 `phoneNumber` 반환에 추가 계약이 필요할 수 있다. 번호를 DB에 보유할 필요가 없으므로 반환 옵션을 추가 구매하거나 번호 문자열 유무를 인증 성공 조건으로 삼지 않았다. **임의 provider의 VERIFIED를 인정하는 것이 아니라 지정한 LIVE 다날 본인인증 채널만 인정한다.** 이름과 번호를 계정의 기존 실명/번호에 대조하는 절차도 아니다. 계정에는 그런 원문이 없다.

서버 조회 원문에는 이름·번호·생년월일·CI/DI 등이 들어올 수 있다. 메모리에서 최소 증거로 줄인 뒤 원문 참조를 남기지 않으며 DB·앱 로그·클라이언트 응답에 복사하지 않는다. JS 메모리를 즉시 안전하게 덮어쓴다거나 인증사/통신사 보관 기록도 즉시 삭제한다는 보장은 하지 않는다. 관측 도구의 HTTP body/Authorization 캡처 및 복귀 URL query 기록은 실제 인프라에서 별도 검증해야 한다.

성별·만 나이는 여전히 자기기입이다. 성적 지향을 판별하지 않으며, CI/DI를 저장하지 않으므로 1인 1계정 중복 가입 차단도 제공하지 않는다.

## 개통 전 필수 조건

1. 운영자가 PortOne 계정/사업자 상태 및 이 서비스 업종으로 다날 본인인증 계약이 가능한지 확인. 본인인증만 사용해도 PG 계약이 필요하다. 계약·요금·보유기간은 추정하지 않는다.
2. LIVE 다날 채널, Store ID, 채널 키, V2 API Secret 발급. secret은 채팅/코드/스크린샷이 아닌 서버 전용 secret manager에 입력한다. Preview와 Production을 분리하고 의도하지 않은 Preview에서 라이브 인증이 열리지 않게 한다.
3. 실제 계약상 처리자·항목·기간·이전·문의 경로를 `/privacy`와 동의 안내에 게시하고 안내 버전을 재검토한다. `lib/identity/notice.ts`의 `IDENTITY_PROVIDER_NOTICE_READY=false`는 이 단계와 아래 비용/로그 대책 검토 후 코드 리뷰를 거쳐서만 변경한다. 환경변수만으로 해제할 수 없다.
4. **앱 요청 제한은 총 과금 한도 보장이 아니다.** 시작 API는 계정 3회/일 + 전체 100회/일이지만 공개 store/channel을 재사용한 SDK 직접 호출과 인증사 화면의 재전송을 통제하지 못한다. 인증사/계약 차원의 금액·일별·번호별 제한, 허용 도메인과 남용 차단, 알림·비상 중단 방법을 확인해야 한다. 제공되지 않으면 본인인증 채널 비활성 상태 유지 또는 설계 재검토. 문서상의 앱 제한만으로 과금 안전을 승인하지 않는다.
5. callback URL query·요청/응답 body·Authorization이 플랫폼 로그, tracing, session replay에 수집되지 않는지 점검한다. 운영 지원 화면에서 원문 인증 내역을 복사하지 않는다. 인증사 자신의 보관 의무는 별도 고지한다.
6. 명시적으로 승인한 실제 채널/예산/본인 명의 테스트 참여자로 PC popup, 모바일 복귀, 취소, 만료, 재시도, 타인 요청, 프로필 수정 경합, 계정 삭제, 비용 제한을 검증한다. 다날 SMS 본인인증은 테스트환경을 제공하지 않아 계약과 실제 키가 있어야 실연동 검증 가능하다. 이번 테스트는 이 검증을 대체하지 않는다.
7. 기존 기본 프로필 migration의 전체 runner/동시성 통합 점검, exact-SHA Preview 검증과 Production 적용 승인은 별개로 필요하다. 인증이 닫힌 현재 상태를 Production에 적용하면 소개 기능이 막히므로 merge/deploy하지 않는다.

환경변수 이름은 `.env.example`에만 추가했다. 실제 값은 설정하지 않았다. `UNSTANDARD_IDENTITY_ENABLED=false`가 기본이며 false로 되돌리면 새 인증 시작/완료를 중단한다. 이미 공개된 store/channel의 외부 직접 호출까지 중단하려면 인증사 채널 중지도 필요하다. 기존 인증된 사용자의 소개 접근을 종료하는 전체 서비스 중단 스위치는 아니다.

## 검증 기록

- 합성 provider HTTP 및 browser SDK stub 테스트: 결과 상태/버전/채널/요청 ID/이름/날짜 위조, raw 응답 축소, JSON/크기 제한, 오류/timeout, 동의 누락, 모바일 복귀, 서버 완료 거절, 시간 경과 만료. 실제 문자·실명·전화번호를 사용하지 않았다.
- 최초 단계의 격리 Neon 검증 증거는 `docs/evidence/profile-identity-20260828/verification.json`에 보존한다. 이번 adapter 변경은 schema/migration을 추가하지 않는다. 합성 테스트를 실인증이나 브라우저 E2E 통과로 표시하지 않는다.
- `npm run check`: PASS — lint, TypeScript, 332 tests (0 failed), Next build. `guard:boundaries`, `guard:no-legacy-backend` 및 staged diff whitespace 검사 PASS (tracked 414 / active 233).
- 실제 server factory를 react-server 조건에서 실행하고 합성 설정을 완전히 주입해도 null 반환 확인. 빌드된 client JS에 `PORTONE_API_SECRET`, `UNSTANDARD_IDENTITY_ENABLED`, canonical server API URL 문자열이 없는 것도 확인했다. 이는 실제 운영 로그/시크릿 감사를 대체하지 않는다.
- Cloud Browser localhost 접근 제한으로 실브라우저 E2E/스크린샷은 미완료. 인증사 live key/계약도 제공받지 않았으며 live API에 요청하지 않았다.
- Production DB, main, Vercel Production 설정/배포는 변경하지 않았다.

## 보안 반대 관점 검토

- 공격자가 SDK 성공을 조작한다 → canonical 조회 및 사용자 소유 요청/프로필 revision 검사가 필요하다. 브라우저 success는 증거로 사용하지 않는다.
- 다른 PG나 TEST 성공을 재사용한다 → 정확한 LIVE 다날 채널·V2·UUID를 검사한다. 응답에 해당 정보가 없으면 실테스트에서 불편하더라도 자동 승인하지 않는다.
- 공개 채널을 직접 호출해 과금한다 → 앱 코드만으로 해결되지 않는다. 운영 gate를 닫고 제공사 통제 확인을 필수로 남겼다.
- raw 오류가 로그/브라우저로 샌다 → adapter/SDK 오류를 일반 문구로 축소하고 원문을 저장하지 않는다. 플랫폼 자동 캡처는 실제 설정/드릴 없이는 검증 완료로 표시하지 않는다.
- 승인 시각 직전 만료/프로필 변경 → 외부 조회 후 시계와 DB row lock 내 revision/만료를 재검사한다.

## 공식 근거 (2026-08-28 확인)

- [PortOne V2 본인인증 흐름 및 응답 항목](https://developers.portone.io/opi/ko/extra/identity-verification/readme-v2?v=v2)
- [다날 전용 입력과 bypass 규격](https://developers.portone.io/opi/ko/integration/pg/v2/danal-identity-verification?v=v2)
- [SDK 본인인증 요청 형식](https://developers.portone.io/sdk/ko/v2-sdk/identity-verification-request?v=v2)
- [본인인증 REST API](https://developers.portone.io/api/rest-v2/identityVerification)
- [계약 필요 및 다날 테스트환경 제한](https://help.portone.io/category/service/identity-verification)
- REST 응답 및 GET query/header 형식은 공식 `@portone/server-sdk` 0.19.0 배포 타입과 생성 client 코드도 대조했다. 서버 SDK 자체는 런타임 의존성에 추가하지 않았다.
