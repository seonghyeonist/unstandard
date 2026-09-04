# Closed Alpha OAuth 인증 경계

작성: 2026-09-03 · Better Auth 1.6.23 기준

**INVITE_GATED / GOOGLE_AND_NAVER_ONLY / PASSWORD_AUTH_PRESERVED**

## 가입 흐름

1. 가입 화면에서 초대코드, 초대 이메일, 만 19세 확인, 이용약관, Community Safety Rules를 제출한다.
2. 서버가 초대를 `reserved`로 만들고 서명된 httpOnly registration ticket을 발급한다. ticket에는 이메일·invite id·예약 capability·법정책 버전만 있으며 원문 인증정보는 없다.
3. 이메일/비밀번호 가입은 기존 Better Auth `/sign-up/email` gate를 통과한다. Google 가입은 `signIn.social({ requestSignUp: true })`, Naver 가입은 generic-oauth의 `signIn.oauth2({ providerId: "naver", requestSignUp: true })`를 호출하기 전에 같은 claim을 통과한다.
4. OAuth callback의 Better Auth `databaseHooks.user.create.before`에서 ticket 존재·예약 유효성·OAuth 반환 이메일과 ticket 이메일의 정규화된 일치를 재검사한다. 누락·불일치·만료·이미 소비된 초대는 신규 user row 생성 전에 거절한다.
5. 신규 user 생성 후 기존 finalization transaction이 invite consume, legal acceptance, `invite_finalized_at`, profile bootstrap을 처리한다. 실패 시 생성된 계정과 예약을 안전하게 보상한다.

OAuth query state, provider display name, image, phone, profile payload를 application profile로 사용하지 않는다. 로컬 사용자 이름은 `Member`로 시작하며, 실제 닉네임은 profile setup에서 별도로 받는다.

## Provider 및 linking 정책

- Better Auth에는 Google 내장 provider와 generic OAuth로 등록한 Naver만 설정한다. Apple·임의 provider·manual success route는 없다.
- 신규 가입은 provider별 `disableImplicitSignUp: true`이고 UI가 명시적으로 `requestSignUp: true`를 보낼 때만 시도한다.
- `account.accountLinking.enabled=false`와 `disableImplicitLinking=true`로 기존 로컬 이메일에 신뢰되지 않은 OAuth 계정을 자동 연결하지 않는다. 이미 같은 provider account가 연결된 기존 계정의 로그인과 신규 가입은 서로 구분한다.
- Google은 provider `email_verified` claim을 반영한다. Naver는 authenticated account email을 invite match에 사용하지만, Naver가 반환하는 이메일을 별도 법적 이메일 인증 증거로 과장하지 않는다.
- 이메일/비밀번호 인증은 유지한다. 비밀번호는 기존 10자 이상 정책과 rate limit을 그대로 사용한다.

## 외부 설정

Naver endpoint와 profile response 형식은 [Naver Login API 공식 명세](https://developers.naver.com/docs/login/api/api.md)를 기준으로 했다. Naver가 반환한 profile payload는 adapter 안에서 최소한의 `id`·`email`·고정 표시명으로 줄인 뒤 Better Auth로 넘긴다.

서버 전용 변수:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NAVER_CLIENT_ID
NAVER_CLIENT_SECRET
BETTER_AUTH_URL
UNSTANDARD_APP_URL
```

실제 도메인에서 provider console의 callback allowlist에는 일반적으로 다음 경로를 등록한다. Better Auth base path와 도메인은 배포 설정으로 최종 확인한다.

```text
https://unstandard.app/api/auth/callback/google
https://unstandard.app/api/auth/oauth2/callback/naver
```

Preview callback은 Production과 별도 OAuth application/credential로 구성한다. client bundle에 `*_CLIENT_SECRET`를 넣지 않는다. OAuth provider 이름·이메일·token 원문은 로그, analytics, error URL, support screenshot에 남기지 않는다.

## 검증 및 잔여 확인

- 코드에는 social provider 설정, callback 초대 gate, implicit linking 차단, register UI의 claim 선행이 반영돼 있다.
- Naver는 공식 OAuth authorize/token/profile endpoint를 generic OAuth adapter로 제한해 사용한다. 실제 Google/Naver consent 화면, callback allowlist, provider email behavior, ticket 만료/재시도, 기존 계정 자동 linking 차단은 sandbox 계정으로만 검증해야 한다.
- provider client secret, verified domain, OAuth app publishing/consent screen, Naver developer permission과 redirect allowlist는 창업자가 외부 console에서 설정해야 한다.
- 실제 invite user 초대, OAuth live login, Production secret 변경, main merge는 이번 작업에서 하지 않았다.
