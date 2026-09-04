# 2026-09-04 Google / Naver OAuth 외부 설정 가이드

대상: UNSTANDARD Closed Alpha / Draft PR #80

**PREVIEW_FIRST / SERVER_ONLY_SECRETS / EXACT_CALLBACK / INVITE_GATED**

이 문서는 다음 작업일에 창업자가 Google Cloud와 NAVER Developers에서 OAuth 애플리케이션을 만들고, Vercel Preview에만 credential을 연결한 뒤 실제 smoke test를 수행하기 위한 운영 가이드다. Production credential, Production DB, main merge, 실사용자 초대는 이 문서의 범위가 아니다.

## 0. 현재 코드 계약

PR #80의 현재 OAuth 구현은 다음 서버 전용 환경변수를 읽는다.

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NAVER_CLIENT_ID
NAVER_CLIENT_SECRET
BETTER_AUTH_SECRET
BETTER_AUTH_URL
UNSTANDARD_APP_URL
DATABASE_URL
UNSTANDARD_RUNTIME_MODE=database
DATABASE_ENV=staging
```

현재 callback 경로는 코드 기준 다음과 같다.

```text
Google: /api/auth/callback/google
Naver:  /api/auth/oauth2/callback/naver
```

따라서 Preview origin이 `https://PREVIEW_ORIGIN`이라면 provider console에 등록할 callback은 다음과 같다.

```text
https://PREVIEW_ORIGIN/api/auth/callback/google
https://PREVIEW_ORIGIN/api/auth/oauth2/callback/naver
```

OAuth display name, profile image, phone, 이름 등은 application profile로 복사하지 않는다. Naver는 invite email match에 필요한 authenticated email만 사용하고, Google도 provider profile을 앱 프로필로 사용하지 않는다. 자동 account linking과 implicit signup은 코드에서 차단돼 있다.

## 1. 가장 안전한 실행 순서

### 1-1. PR exact-head Preview를 먼저 만든다

1. Draft PR #80의 현재 head SHA를 다시 확인한다.
2. `feat/alpha-profile-identity-20260828`를 Vercel Preview로 배포한다.
3. Preview DB는 Production DB가 아니라 Neon 격리 branch를 사용한다.
4. 이 첫 Preview에는 OAuth credential이 아직 없어도 된다. provider availability가 false로 남을 뿐이다.
5. 배포 후 Vercel이 제공하는 HTTPS Preview origin을 기록한다.

가능하면 배포마다 바뀌는 deployment URL보다 해당 branch에 연결되는 안정적인 Preview/branch alias를 callback origin으로 사용한다. 안정적 alias를 확정할 수 없다면 exact deployment URL을 사용하되, 다음 재배포 전에 provider callback도 새 URL과 정확히 맞춘다.

### 1-2. Preview origin 확정 후 provider app을 만든다

Google과 Naver 모두 callback/redirect URL 불일치가 OAuth 실패의 대표 원인이다. 먼저 실제 Preview origin을 확보한 다음 provider console을 구성한다.

---

# 2. Google OAuth 설정

공식 문서:
- Google OAuth 2.0 for Web Server Applications: https://developers.google.com/identity/protocols/oauth2/web-server
- OAuth 2.0 Policies: https://developers.google.com/identity/protocols/oauth2/policies

## 2-1. Google Cloud project

권장 이름 예시:

```text
UNSTANDARD Preview OAuth
```

Closed Alpha 테스트와 향후 Production publishing을 분리하기 위해 Preview/개발용 project를 Production과 분리하는 편이 안전하다.

## 2-2. OAuth consent / Audience

1. Google Cloud Console에서 OAuth consent / Google Auth Platform 설정으로 이동한다.
2. Audience는 외부 사용자를 대상으로 한다면 `External`로 설정한다.
3. 초기 smoke 단계는 `Testing`으로 둔다.
4. 테스트에 사용할 Google 계정을 Test users에 추가한다.
5. 앱 이름은 실제 브랜드를 식별할 수 있게 `UNSTANDARD`로 둔다.
6. 홈페이지, 개인정보처리방침, 이용약관 링크를 요구받는 경우 현재 공개된 UNSTANDARD 페이지를 사용한다.
7. 요청 scope는 로그인에 필요한 최소 범위만 사용한다. 현재 구현 목적상 이름/주소/전화번호/Drive 등 추가 Google API scope를 만들 이유가 없다.

Google Testing 상태는 테스트 사용자 기반 개발에 적합하지만, 실제 Closed Alpha 전체 공개 범위는 Google의 현재 publishing/verification 정책을 다시 확인한 뒤 전환한다.

## 2-3. OAuth client 생성

1. OAuth Client 생성 화면에서 **Web application**을 선택한다.
2. 이름 예시:

```text
UNSTANDARD Preview Web
```

3. Authorized redirect URI에 정확히 다음 한 개를 우선 등록한다.

```text
https://PREVIEW_ORIGIN/api/auth/callback/google
```

4. 현재 UNSTANDARD 흐름은 server-side authorization-code callback이므로 Authorized JavaScript Origin을 억지로 추가하지 않는다. 실제 Google console 또는 런타임이 요구할 때만 추가한다.
5. 발급된 Client ID와 Client Secret을 GitHub, 채팅, 문서에 붙여넣지 않는다.

Google은 `redirect_uri`가 console의 Authorized redirect URI와 scheme, host, path, trailing slash까지 정확히 일치해야 한다. `redirect_uri_mismatch`가 뜨면 코드보다 이 값을 먼저 본다.

## 2-4. Vercel Preview env

Vercel Project `unstandard-m9qj`의 **Preview environment에만** 다음을 입력한다.

```text
GOOGLE_CLIENT_ID=<Google Preview client id>
GOOGLE_CLIENT_SECRET=<Google Preview client secret>
BETTER_AUTH_URL=https://PREVIEW_ORIGIN
UNSTANDARD_APP_URL=https://PREVIEW_ORIGIN
```

`NEXT_PUBLIC_APP_URL`을 Preview origin으로 맞출 필요가 있는 UI가 있다면 함께 설정할 수 있지만, Google client secret을 `NEXT_PUBLIC_*` 변수에 넣는 일은 절대 하지 않는다.

---

# 3. Naver OAuth 설정

공식 문서:
- 애플리케이션 등록: https://developers.naver.com/docs/common/openapiguide/appregister.md
- 로그인 개발가이드: https://developers.naver.com/docs/login/devguide/devguide.md
- 로그인 API 명세: https://developers.naver.com/docs/login/api/api.md
- 사전 검수: https://developers.naver.com/docs/login/verify/verify.md

## 3-1. Application 생성

NAVER Developers에서 애플리케이션을 생성한다.

권장 이름:

```text
UNSTANDARD Preview
```

사용 API는 **네이버 로그인**만 선택한다.

## 3-2. 제공 정보 권한 최소화

현재 코드가 Naver에서 실제로 필요한 핵심 profile field는 invite match용 `email`이다.

따라서:

- 이메일: 필요
- 이름: 불필요
- 별명: 불필요
- 프로필 이미지: 불필요
- 휴대전화번호: 불필요
- 생일/출생연도/성별 등: OAuth 가입 목적으로 불필요

서비스가 실제로 사용하지 않는 profile permission을 편의상 추가하지 않는다. Naver 사전 검수도 실제 활용처가 없는 정보의 과다 요청을 문제 삼을 수 있다.

## 3-3. 서비스 환경

웹 서비스 환경을 추가하고 실제 Preview origin을 기준으로 등록한다.

Service URL 예시:

```text
https://PREVIEW_ORIGIN
```

Callback URL:

```text
https://PREVIEW_ORIGIN/api/auth/oauth2/callback/naver
```

Naver API는 callback으로 받은 `code`와 `state`를 사용해 token exchange를 수행한다. 현재 PR 코드는 `state`를 token exchange에 다시 전달하도록 구현돼 있으므로 외부 설정에서 callback URL만 정확히 맞추고 state 관련 custom workaround를 추가하지 않는다.

## 3-4. 개발 테스트 계정

Naver 공식 가이드상 사전 검수를 통과하지 않은 개발 단계에서도 **관리자/테스터로 등록된 Naver ID**는 로그인 테스트가 가능하다. 실제 모든 사용자에게 개방하려면 사전 검수를 통과해야 한다.

따라서 다음 작업일 smoke는 먼저 founder/tester Naver ID로 진행하고, Closed Alpha 공개 전 별도로 사전 검수 상태를 정리한다.

## 3-5. Vercel Preview env

```text
NAVER_CLIENT_ID=<Naver Preview client id>
NAVER_CLIENT_SECRET=<Naver Preview client secret>
BETTER_AUTH_URL=https://PREVIEW_ORIGIN
UNSTANDARD_APP_URL=https://PREVIEW_ORIGIN
```

Naver Client Secret 역시 서버 전용이다.

---

# 4. OAuth credential 입력 후 같은 SHA 재배포

1. Google/Naver Preview credential과 URL env를 저장한다.
2. Vercel Preview를 재배포한다.
3. 재배포 결과가 **처음 검증 대상으로 잡은 PR head와 동일 SHA**인지 확인한다.
4. SHA가 달라졌다면 smoke evidence를 섞지 말고 새 SHA를 기준으로 다시 시작한다.

## 5. 필수 smoke matrix

### Google

- [ ] 기존에 provider account가 정상 연결된 계정의 로그인
- [ ] 유효 invite + invite email과 동일한 Google email로 신규 가입
- [ ] invite 없음 -> 신규 account 생성 전 거절
- [ ] invite email과 Google email 불일치 -> 거절
- [ ] 기존 local email과 같은 Google email이라고 해서 자동 linking되지 않음
- [ ] consent 취소/실패 후 account/orphan이 생기지 않음

### Naver

- [ ] tester/admin Naver ID 로그인 화면 진입
- [ ] 유효 invite + Naver authenticated email 일치 신규 가입
- [ ] invite 없음 -> 거절
- [ ] email mismatch -> 거절
- [ ] callback `state` round-trip 정상
- [ ] Naver profile API 실패/권한 부족 시 fail closed
- [ ] 기존 local account에 implicit linking되지 않음

### 공통

- [ ] provider Client Secret/token/code가 browser HTML, URL, analytics, logs에 노출되지 않음
- [ ] provider 이름/전화/프로필 이미지가 application profile에 저장되지 않음
- [ ] Preview DB에 예상하지 않은 orphan user/account/invite reservation이 남지 않음
- [ ] smoke 직후 exact deployed SHA와 Preview hostname을 evidence에 기록

## 6. PASS 판정

Google 또는 Naver의 버튼이 보인다는 사실만으로 PASS가 아니다.

각 provider는 다음이 모두 확인돼야 외부 blocker를 닫을 수 있다.

```text
provider app configured
+ exact callback registered
+ Preview-only secrets present
+ exact-head Preview READY
+ valid invite signup PASS
+ invalid/no invite FAIL-CLOSED
+ email mismatch FAIL-CLOSED
+ implicit linking blocked
+ no secret/PII leakage observed
```

## 7. 즉시 중단 조건

다음 중 하나라도 발생하면 Production으로 진행하지 않는다.

- callback URL mismatch를 임시 redirect/rewrite로 우회해야 하는 상태
- provider secret이 client bundle 또는 public env에 노출됨
- invite 없이 OAuth account가 생성됨
- provider email mismatch인데 가입됨
- 기존 계정에 provider가 자동 연결됨
- Naver state 검증/exchange가 불안정함
- smoke 대상 Preview SHA와 문서에 적힌 SHA가 다름
- Preview가 Production DB에 연결됨

## 8. Production 전환은 별도 작업

Preview smoke가 모두 통과해도 바로 `CLOSED_ALPHA_READY`가 아니다.

다음은 별도 gate다.

1. Google Production/publishing 상태와 필요한 검증 확인
2. Naver 사전 검수 완료 여부 확인
3. Production OAuth application/credential 분리 또는 승인된 운영 credential 확정
4. 동일 SHA Production 배포
5. Production readiness evidence 재생성
6. Closed Alpha 운영 gate 재실행

Preview 성공 증거를 Production 성공 증거로 승격하지 않는다.
