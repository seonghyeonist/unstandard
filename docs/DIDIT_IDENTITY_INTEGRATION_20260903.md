# Didit V3 신원·성인 확인 연동

작성: 2026-09-03 · Draft PR #80 후속

**TECHNICAL_PREPARATION_ONLY / LIVE_AUTHENTICATION_BLOCKED / NOT_READY_FOR_PRODUCTION**

이 문서는 Didit hosted KYC를 Unstandard의 초대제 Closed Alpha에 연결하기 위한 코드·계약 경계다. 실제 Didit 계정, 유료 계약, 실사용자 인증, Production 환경변경을 의미하지 않는다. `lib/identity/notice.ts`의 `IDENTITY_PROVIDER_NOTICE_READY=false`가 유지되므로 환경변수만으로 수집이 켜지지 않는다.

## 범위

- 별도 인증 동의 후 Didit hosted 화면으로 이동한다.
- 서버가 생성한 내부 UUID를 `vendor_data`로만 보낸다. 이름·이메일·닉네임·성별·나이·전화번호·생년월일·metadata·expected_details·contact_details는 세션 생성 요청에 넣지 않는다.
- Didit 서버 API의 `session_id`를 내부 `providerReference`로 바인딩한다. 브라우저 callback query나 hosted 화면의 성공 주장은 증거가 아니다.
- `GET /v3/session/{session_id}/decision/`의 V3 복수 배열에서 ID verification, passive liveness, face match, IP analysis가 모두 `Approved`인지 확인하고, 승인된 ID의 생년월일로 현재 시점 만 19세 이상을 계산한다.
- provider-neutral proof는 `requestId`, `providerReference`, `verifiedAt`, `documentVerified`, `livenessVerified`, `faceMatchVerified`, `deviceIpVerified`, `adultVerified`뿐이다. Didit 원문, 얼굴 영상/이미지, 이름, 문서번호, 생년월일, 주소, media URL은 저장·응답·로그로 넘기지 않는다.
- 확인 전에 `DELETE /v3/session/{session_id}/delete/`를 호출한다. 응답의 `face_retention_outcome`가 `deleted` 또는 얼굴 템플릿이 없음을 뜻하는 `none`이고 얼굴 템플릿 식별값이 null일 때만 `verified`로 올린다. 404·보류·보존·불명확한 `none` 응답은 성공으로 처리하지 않는다.
- 웹훅은 Didit 문서의 `X-Signature-V2` 또는 단순 envelope 서명을 5분 timestamp freshness·constant-time HMAC 비교로 검증하고, 어느 경우에도 canonical GET을 다시 한다. `status.updated`와 `data.updated` 재전송은 DB 상태에 의해 멱등 처리된다.

## 저장 상태와 접근 제어

`identity_verifications`에는 `provider_reference`, `biometric_consent_version`, `provider_purged_at`를 추가했다. 상태는 `pending → verified_unpurged → verified` 세 단계다. `verified_unpurged`는 소개 접근을 허용하지 않는다. SQL eligibility와 순수 정책 모두 현재 profile revision, 안내/동의 버전, `provider_reference`, `provider_purged_at >= verified_at`를 요구한다.

기존 provider-era `verified` 행을 Didit consent/purge evidence로 추정하지 않도록 migration 0011은 해당 증거를 `pending`으로 무효화하고 legacy consent marker를 넣는다. Production에는 migration을 실행하지 않았다.

## 공식 계약 확인

Didit 문서 기준으로 Create Session은 [V3 Create Session](https://docs.didit.me/sessions-api/create-session), canonical read는 [Retrieve Session](https://docs.didit.me/sessions-api/retrieve-session), 삭제는 [Delete Session](https://docs.didit.me/sessions-api/delete-session)이다. 웹훅 서명·재시도·V3 복수 배열은 [Webhooks](https://docs.didit.me/integration/webhooks)를 기준으로 했다.

Didit의 한국 안내 페이지에는 한국 신분증으로 주민등록증, 운전면허증, 대한민국 여권, 외국인등록증 4종이 표시된다: [Didit 한국 안내](https://didit.me/ko/solutions/countries/south-korea/). 실제 계정의 workflow에서 해당 사용자의 신분증 subtype이 활성화되었는지는 별도 확인이 필요하다.

## 외부 확인 없이는 닫힌 항목

- Didit Business Console 계정, sandbox/live application, `DIDIT_WORKFLOW_ID`, workflow version과 실제 feature graph.
- 한국 4종 문서의 계정별 인식 범위, 대체 문서·예외 케이스, 성인 기준 계약 문구.
- DPA, subprocessors, 처리자/법인, region, 국외이전, console/API retention, deletion SLA와 얼굴 embedding 보존 조건. Didit의 일반 보안·retention 안내는 [Security & Compliance](https://docs.didit.me/getting-started/security-compliance), [Data Retention](https://docs.didit.me/console/data-retention)에서 확인하되 계약 사실로 간주하지 않는다.
- webhook destination URL/secret, Didit 측 IP/WAF 설정, API/application rate limit, 총비용 상한·알림·긴급 중단.
- 현재 가격 페이지의 표시값은 계약 견적이 아니다. [Didit pricing](https://didit.me/pricing/)을 참고만 하고, 창업자가 실제 비용·무료 한도·세금·환불 조건을 확정해야 한다.
- Vercel/Neon/observability가 callback query, HTTP body, authorization header, provider error를 수집하지 않는다는 실제 운영 로그 증거.

## 구현 파일과 검증

- `lib/identity/didit.ts`: config, session create, canonical decision, purge adapter.
- `lib/identity/didit-webhook.ts`, `app/api/identity/webhook/route.ts`: V2 HMAC, freshness, queue signal, canonical re-fetch.
- `lib/identity/contracts.ts`, `lib/identity/service.ts`, `lib/db/repositories/identity.repository.ts`: provider-neutral proof와 purge-before-unlock state machine.
- `lib/identity/browser-flow.ts`, `components/profile/profile-basics-form.tsx`: consent + hosted redirect. Didit session token은 client로 보내지 않는다.
- `tests/identity-verification.test.ts`: 합성 HTTP에서 request minimization, V3 array checks, adult calculation, purge outcome, PII non-persistence, browser untrusted callback, webhook signature를 검증한다.

실제 live API, 실명·문서·영상, 외부 webhook console, Production DB migration, Production secret, main merge는 수행하지 않았다. 시작/완료 API는 gate가 false인 동안 503을 반환한다.

## 중단·복구

1. 앱 측 신규 시작/완료는 `IDENTITY_PROVIDER_NOTICE_READY=false` 유지와 deployment rollback으로 닫는다.
2. 외부 Didit 과금·재전송을 멈추려면 Didit workflow/application/destination을 console에서 별도로 중지·회전한다.
3. 운영에 적용된 뒤에는 먼저 소개 접근을 닫고, provider 세션 삭제 및 DB 상태를 확인한 뒤 rollback한다. 코드 rollback만으로 이미 인증된 상태나 외부 보관분을 삭제했다고 간주하지 않는다.
