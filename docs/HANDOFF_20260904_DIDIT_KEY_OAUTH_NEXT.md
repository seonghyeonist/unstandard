# 2026-09-04 Didit API key + OAuth 다음 작업일 인수인계

## 현재 판정

**TECH_PREPARED_AWAITING_OAUTH_EXTERNAL_SETUP_AND_DIDIT_SANDBOX_BINDING**

이 판정은 Closed Alpha 출시 승인이 아니다. `CLOSED_ALPHA_READY`를 선언하지 않는다.

오늘 창업자는 Vercel Preview 환경변수 `DIDIT_API_KEY` 값 칸에 Didit Sandbox API key를 직접 입력했다고 보고했다. Secret 값은 문서·GitHub·채팅에 기록하지 않는다.

중요: 현재 연결된 Vercel 도구는 Project/Deployment 상태는 읽을 수 있지만 환경변수 secret의 존재/값을 열람하는 기능이 없으므로, 아래 문서에서는 이 상태를 **FOUNDER_REPORTED_SET / NOT_CONNECTOR_VERIFIED**로 기록한다.

## 1. GitHub 현재 상태

- Repository: `seonghyeonist/unstandard`
- Draft PR: #80 `feat: prepare invite-gated OAuth and Didit KYC boundaries`
- PR state: OPEN / DRAFT / mergeable
- PR branch: `feat/alpha-profile-identity-20260828`
- 이 인수인계 작성 직전 확인된 PR head: `0c56818733bd0b6f0f81bcb5db67e5ed761ff1ce`
- base: `main`
- PR 본문에는 현재 head 기준 CI와 Rebuild CI green, 338 tests/local checks PASS가 기록돼 있다.
- main merge는 하지 않는다.

오늘 추가 문서 커밋으로 branch head는 위 PR 확인 시점 이후 앞으로 이동한다. 다음 작업일에는 **무조건 PR의 최신 head SHA를 다시 읽고** 그 SHA를 Preview smoke 기준으로 삼는다.

## 2. Vercel 현재 상태

확인된 Project:

```text
team: unstandard
project: unstandard-m9qj
project id: prj_9RHqHMFTeB0c2V3LGlAdTezmvcYn
```

현재 관측된 최신 Production deployment:

```text
state: READY
target: production
main SHA: 30d0c78ee19d652fed2bedcae7271931f8f04b31
```

이 Production SHA와 PR #80의 OAuth/Didit branch SHA는 다르다. Production READY를 PR #80 기능 검증 증거로 사용하지 않는다.

### Didit env 상태

| 변수 | 상태 | 비고 |
|---|---|---|
| `DIDIT_API_KEY` | **FOUNDER_REPORTED_SET** | Vercel Preview에 Sandbox key 입력 보고. 값/존재는 connector로 검증 불가 |
| `DIDIT_WORKFLOW_ID` | **UNCONFIRMED** | 기존 문서에 Free KYC candidate workflow id가 있으나 현재 Preview env binding 미확인 |
| `DIDIT_WEBHOOK_SECRET` | **UNCONFIRMED** | V3 Preview webhook destination 생성 후 입력 필요 |
| `UNSTANDARD_IDENTITY_ENABLED` | **UNCONFIRMED** | env만 켜도 코드 notice gate가 false면 수집은 열리지 않음 |
| `BETTER_AUTH_URL` | 다음 Preview에서 확정 | exact Preview origin 필요 |
| `UNSTANDARD_APP_URL` | 다음 Preview에서 확정 | exact Preview origin 필요 |

현재 코드의 `IDENTITY_PROVIDER_NOTICE_READY=false` 경계는 그대로 유지해야 한다. Didit API key 하나가 들어갔다고 실제 KYC 수집이 준비된 것으로 판단하지 않는다.

## 3. Neon 현재 상태

확인된 Preview/App DB project:

```text
project: unstandard-alpha-preview-app-db
project id: raspy-fog-00907976
```

OAuth/identity 검증용 격리 branch:

```text
name: pr80-verification-clean-20260904
branch id: br-hidden-rice-aj5bed7o
state: ready
default: false
parent: main
```

현재 read-only 확인 결과:

```text
identity_verifications rows: 0
users rows: 5
alpha_invites rows: 12
```

`identity_verifications`, `profile_basics`, `legal_acceptances` 등 필요한 테이블이 이 격리 branch에 존재한다. 이 branch는 main과 분리돼 있으며 다음 Preview smoke의 우선 DB 후보로 유지한다.

Production/default branch에 새 migration을 적용했다고 간주하지 않는다.

별도 disposable integration project `sweet-king-54269784`에서는 현재 조회 시 main branch만 보인다. 과거 handoff에 적힌 temporary migration branch를 현재 살아 있는 검증 branch로 가정하지 않는다.

## 4. 오늘 완료된 항목

- [x] PR #80 OAuth/Didit 코드·문서 상태 재확인
- [x] Vercel Project와 최신 Production deployment 확인
- [x] Neon `pr80-verification-clean-20260904` ready 상태 확인
- [x] Neon clean branch에 identity schema 존재 확인
- [x] clean branch identity orphan 0건 확인
- [x] 창업자 보고 기준 Vercel Preview `DIDIT_API_KEY` Sandbox key 입력 완료
- [x] Google/Naver OAuth 다음 작업일 외부 설정 가이드 작성
- [x] OAuth callback 경로와 server-only env contract 재확인

## 5. 다음 작업일 최우선 목표

**Google OAuth + Naver OAuth 외부 계정/credential을 만들고 exact PR Preview에서 authenticated smoke를 끝내는 것.**

다음 문서를 먼저 연다.

```text
docs/OAUTH_EXTERNAL_SETUP_GUIDE_20260904.md
```

## 6. 다음 작업일 권장 실행 순서

### STEP 0 — 기준 SHA 다시 확정

1. PR #80 current head SHA 확인
2. CI 상태 확인
3. 이 SHA를 그날의 smoke 기준 SHA로 고정

오늘 문서 추가 때문에 `0c568...`를 다음 작업일의 exact head라고 가정하지 않는다.

### STEP 1 — exact-head Preview 1차 배포

1. PR branch를 Vercel Preview로 배포
2. DB는 `pr80-verification-clean-20260904` 같은 격리 Neon branch만 연결
3. Production DB URL 사용 금지
4. HTTPS Preview origin 또는 stable branch alias 확보

OAuth client가 아직 없어도 첫 Preview 배포는 가능하다. 먼저 callback origin을 확보하는 것이 목적이다.

### STEP 2 — Google OAuth app 생성

1. 별도 Preview/Test Google Cloud project 권장
2. OAuth audience External / Testing
3. founder/test Google 계정을 test user로 등록
4. Web application client 생성
5. callback 등록:

```text
https://PREVIEW_ORIGIN/api/auth/callback/google
```

6. 발급값을 Vercel Preview에만 입력:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

### STEP 3 — Naver OAuth app 생성

1. NAVER Developers에서 application 생성
2. 사용 API: 네이버 로그인
3. Web 환경 등록
4. email 권한만 최소한으로 사용
5. callback 등록:

```text
https://PREVIEW_ORIGIN/api/auth/oauth2/callback/naver
```

6. founder/tester Naver ID를 개발 테스트 대상으로 설정
7. 발급값을 Vercel Preview에만 입력:

```text
NAVER_CLIENT_ID
NAVER_CLIENT_SECRET
```

사전 검수를 통과하지 않아도 관리자/테스터 ID로 개발 테스트는 가능하지만, 모든 사용자가 이용하는 정식 공개 전에는 Naver 사전 검수 gate가 별도로 남는다.

### STEP 4 — Preview URL env 정렬

동일 Preview origin으로 다음을 맞춘다.

```text
BETTER_AUTH_URL=https://PREVIEW_ORIGIN
UNSTANDARD_APP_URL=https://PREVIEW_ORIGIN
```

필요한 Preview runtime 설정도 확인한다.

```text
UNSTANDARD_RUNTIME_MODE=database
DATABASE_ENV=staging
DATABASE_URL=<isolated Neon branch>
```

### STEP 5 — 같은 SHA 재배포

Credential/env 저장 후 다시 Preview deploy.

배포된 Git SHA가 STEP 0에서 고정한 SHA와 정확히 같은지 확인한다.

### STEP 6 — OAuth smoke

각 provider에서 최소 다음을 본다.

1. 유효 invite + provider email 일치 신규 가입 PASS
2. invite 없음 FAIL
3. invite email mismatch FAIL
4. implicit signup/linking 우회 불가
5. 기존 계정 자동 linking 없음
6. consent 취소/실패 시 orphan 없음
7. Naver state round-trip 정상
8. provider secret/token/PII log 노출 없음

Smoke 후 Neon에서 예상하지 않은 `users`, `accounts`, invite reservation orphan을 read-only로 확인한다.

### STEP 7 — evidence와 blocker 업데이트

Google/Naver 각각 PASS 근거를 남긴 뒤에만 다음 blocker를 닫는다.

```text
BLOCKED_EXTERNAL_GOOGLE_OAUTH
BLOCKED_EXTERNAL_NAVER_OAUTH
```

버튼이 보이거나 consent page가 열린 것만으로 PASS 처리하지 않는다.

## 7. Didit은 OAuth와 분리해서 계속 보류

오늘 `DIDIT_API_KEY` 입력은 유의미한 진전이지만 다음 항목은 여전히 별개다.

- intended sandbox application과 key의 ownership/environment 확인
- `DIDIT_WORKFLOW_ID` Preview binding
- workflow가 ID verification + passive liveness + face match + IP analysis를 실제 포함하는지 확인
- 한국 4종 문서 coverage 확인
- V3 webhook destination 생성
- `DIDIT_WEBHOOK_SECRET` Preview 입력
- signed webhook 수신
- canonical decision re-fetch
- provider session purge/delete outcome 검증
- DPA/subprocessors/region/retention/deletion/biometric facts
- privacy/legal wording 승인
- `IDENTITY_PROVIDER_NOTICE_READY` 코드 gate 해제 여부의 별도 review

따라서 현재 Didit 관련 blocker는 닫지 않는다.

## 8. 현재 blocker 판정

| Blocker | 현재 상태 | 다음 종료 조건 |
|---|---|---|
| `BLOCKED_EXTERNAL_GOOGLE_OAUTH` | **OPEN** | Google Preview client + exact callback + authenticated smoke PASS |
| `BLOCKED_EXTERNAL_NAVER_OAUTH` | **OPEN** | Naver Preview app + exact callback + tester smoke PASS |
| `BLOCKED_EXTERNAL_DIDIT_ACCOUNT` | **NARROWED** | Sandbox app/key/workflow ownership binding 확인 |
| `BLOCKED_EXTERNAL_DIDIT_SANDBOX_VALIDATION` | **OPEN** | API session + signed webhook + canonical decision + purge + local transition |
| `BLOCKED_EXTERNAL_DIDIT_KOR_DOCUMENT_COVERAGE` | **OPEN** | exact workflow/application에서 한국 4종 확인 |
| `BLOCKED_EXTERNAL_DIDIT_PRIVACY_FACTS` | **OPEN** | 계약/retention/삭제/국외이전/biometric facts 승인 |
| Exact-head Preview smoke | **OPEN** | OAuth/Didit 각각 필요한 authenticated smoke |
| Production same-SHA gate | **NOT STARTED FOR PR #80** | Preview 통과 후 별도 Production readiness/gate 재실행 |

## 9. 금지사항

다음 작업일에도 아래는 하지 않는다.

- OAuth/Didit secret을 GitHub issue, commit, 문서, 채팅에 붙여넣기
- `NEXT_PUBLIC_*`에 client secret 넣기
- Production DB를 Preview smoke에 연결하기
- Preview 성공을 Production 성공으로 간주하기
- OAuth email/profile을 실명 또는 KYC 증거로 과장하기
- OAuth provider의 이름/전화/이미지를 application profile로 복사하기
- Didit browser callback 성공 화면을 canonical KYC 성공 증거로 간주하기
- current PR exact SHA를 확인하지 않고 예전 evidence 재사용하기
- Preview smoke 전 main merge/Closed Alpha 초대 진행하기

## 10. 다음 세션 시작용 한 줄

다음 작업일에는 아래 지시로 바로 이어갈 수 있다.

> `@GitHub @Vercel @Neon PR #80 최신 head와 CI부터 확인하고, docs/OAUTH_EXTERNAL_SETUP_GUIDE_20260904.md 및 docs/HANDOFF_20260904_DIDIT_KEY_OAUTH_NEXT.md 기준으로 exact-head Preview origin 확보 → Google OAuth → Naver OAuth → Preview env → same-SHA OAuth smoke 순서로 진행. Production/main은 건드리지 말 것.`

## 최종 오늘 판정

오늘은 여기서 종료 가능하다.

**Didit Sandbox API key 입력 보고까지 반영됐고, 다음 핵심 창업자 외부 작업은 Google/Naver OAuth application 생성 및 Preview credential binding이다.**

그 작업과 exact-head smoke가 끝나기 전에는 `CLOSED_ALPHA_READY`가 아니다.
