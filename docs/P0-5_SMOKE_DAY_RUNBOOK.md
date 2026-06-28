# P0-5 실측 당일 런북 (Vercel + Supabase)

> **용도:** 내일 손으로 하는 live staging login smoke 전용 체크리스트.  
> **기준 SHA:** `dab230e` (또는 당일 `main` 최신)  
> **상세 규칙:** [`STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md)  
> **Alpha:** **BLOCKED** — PASS여도 변경 없음.

---

## 0. 북마크 (탭 순서대로 열기)

| # | 어디 | 링크 |
|---|------|------|
| 1 | GitHub repo | https://github.com/seonghyeonist/unstandard |
| 2 | GitHub Actions (CI 확인용) | https://github.com/seonghyeonist/unstandard/actions |
| 3 | Vercel Dashboard | https://vercel.com/dashboard |
| 4 | Vercel 프로젝트 (이름 확인 후) | `https://vercel.com/<team>/unstandard` _(팀/프로젝트명은 본인 계정 기준)_ |
| 5 | Supabase Dashboard | https://supabase.com/dashboard/projects |
| 6 | Supabase staging project | `https://supabase.com/dashboard/project/<project-ref>` |
| 7 | 이 런북 (로컬) | `docs/P0-5_SMOKE_DAY_RUNBOOK.md` |

**메모장에 미리 적어둘 빈칸:**

```text
Preview URL:     https://____________________.vercel.app
Supabase ref:    ____________________  (대시보드 URL의 project id)
Git SHA:         dab230e
Tester:          ____________________
Test email:      ____________________  (본인 수신 가능한 주소)
```

---

## 1. 사전 준비 (5분)

### 1-1. 로컬 확인 (선택)

```bash
git fetch origin --prune
git checkout main
git pull --ff-only origin main
git log --oneline -1    # dab230e 이상인지 확인
```

### 1-2. Supabase에서 값 복사해 둘 것

**경로:** Supabase project → **Project Settings** (⚙️) → **API**

| 복사할 항목 | Vercel env 이름 | 예시 형태 (값은 본인 것) |
|-------------|-----------------|-------------------------|
| Project URL | `UNSTANDARD_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
| `anon` `public` key | `UNSTANDARD_SUPABASE_PUBLISHABLE_KEY` | `eyJhbG...` |

> **service_role key는 복사하지 마라.** Vercel에 넣지 않는다.

### 1-3. AUTH_COOKIE_SECRET 생성

터미널에서 한 번 실행:

```bash
openssl rand -base64 32
```

출력 문자열 → Vercel `AUTH_COOKIE_SECRET` 값으로 사용.

---

## 2. Vercel Preview env 설정

**경로:** Vercel → 프로젝트 → **Settings** → **Environment Variables**

각 변수 추가 시 **Environment = Preview** 만 체크. (Production은 이번에 건드리지 않음)

### 2-1. 넣을 변수 (이름 그대로)

| Key | Value | Environment |
|-----|-------|-------------|
| `UNSTANDARD_SUPABASE_URL` | Supabase Project URL | Preview |
| `UNSTANDARD_SUPABASE_PUBLISHABLE_KEY` | Supabase anon public key | Preview |
| `AUTH_COOKIE_SECRET` | `openssl rand` 결과 | Preview |
| `REPORTS_PERSISTENCE_ADAPTER` | `disabled` | Preview |
| `UNSTANDARD_APP_URL` | _(아래 2-2에서 확정 후 입력)_ | Preview |

### 2-2. Preview URL 확정 (중요)

**경로:** Vercel → 프로젝트 → **Deployments** → 최근 Preview 배포 클릭

- **Visit** 버튼의 origin 복사  
  예: `https://unstandard-git-main-seonghyeonist.vercel.app`

이 URL을:

1. 메모장 `Preview URL`에 기록
2. Vercel env `UNSTANDARD_APP_URL`에 **동일하게** 입력
3. 다음 Supabase 단계에서 redirect URL에 사용

### 2-3. 금지 확인

Environment Variables 목록에서 **없는지** 확인:

- [ ] `SUPABASE_SERVICE_ROLE_KEY` — 없음
- [ ] `REPORTS_PERSISTENCE_ADAPTER` = `supabase-alpha` — 없음

하나라도 있으면 **삭제 후** 진행.

### 2-4. OAuth (오늘은 스킵)

- [ ] `UNSTANDARD_SUPABASE_OAUTH_PROVIDER` — **설정하지 않음** (magic link만)

---

## 3. Supabase Auth 설정

**경로:** Supabase project → **Authentication** → **Providers**

### 3-1. Email 활성화

- [ ] **Email** → Enable
- [ ] Confirm email — staging이면 **꺼도** magic link smoke 가능한 경우 많음 (켜져 있으면 메일 확인 후 진행)

### 3-2. URL Configuration

**경로:** Authentication → **URL Configuration**

`<PREVIEW>` = 2-2에서 확정한 origin (끝에 `/` 없음)

| 필드 | 입력값 |
|------|--------|
| **Site URL** | `https://<PREVIEW_HOST>` |
| **Redirect URLs** (Add) | `https://<PREVIEW_HOST>/auth/callback` |

**복사용 템플릿** (`<PREVIEW_HOST>`만 바꿔서 붙여넣기):

```text
Site URL:
https://<PREVIEW_HOST>

Redirect URL (한 줄 추가):
https://<PREVIEW_HOST>/auth/callback
```

예시:

```text
https://unstandard-git-main-seonghyeonist.vercel.app/auth/callback
```

### 3-3. 오늘 하지 않을 것

- [ ] SQL migration 실행 — **안 함**
- [ ] RLS enable — **안 함**
- [ ] OAuth provider 설정 — **안 함**

---

## 4. Redeploy

**경로:** Vercel → **Deployments** → 최근 Preview → **⋯** → **Redeploy**

- [ ] Redeploy 완료 (Building → Ready)
- [ ] Visit로 Preview URL 다시 열어 동일한지 확인

**기록:**

```text
Timestamp UTC: ____________________
```

---

## 5. 브라우저 실측 — 13케이스

브라우저: **시크릿/프라이빗 창** 권장 (쿠키 깨끗하게).

`<PREVIEW>` = 확정한 Preview origin.

### Case 1 — `/login` 로드

| | |
|---|---|
| **열 URL** | `https://<PREVIEW_HOST>/login` |
| **기대** | 200, magic link 이메일 입력 폼, staging 안내 문구 |
| **실패 시 기록** | HTTP status, 화면 스크린샷 |

- [ ] PASS / FAIL: ___

---

### Case 2 — Magic link 요청

| | |
|---|---|
| **동작** | 테스트 이메일 입력 → 제출 |
| **기대** | 성공 메시지 (에러/stack trace 없음) |
| **실패 시** | UI 에러 문구, Network 탭 `signInWithOtp` 관련 요청 |

- [ ] PASS / FAIL: ___

---

### Case 3 — 이메일 링크 → callback

| | |
|---|---|
| **동작** | 받은편지함에서 magic link 클릭 |
| **기대 URL** | `https://<PREVIEW_HOST>/auth/callback?code=...` |
| **실패 패턴** | `localhost:3000`으로 감 → env/Supabase URL 불일치 |

- [ ] PASS / FAIL: ___

---

### Case 4 — PKCE → settings

| | |
|---|---|
| **기대** | `/app/settings`로 리다이렉트 |
| **실패 패턴** | `/login?error=auth_callback_failed` |

- [ ] PASS / FAIL: ___

---

### Case 5 — Settings 로드

| | |
|---|---|
| **열 URL** | `https://<PREVIEW_HOST>/app/settings` (Case 4 후 자동) |
| **기대** | 설정 페이지 정상 표시 |

- [ ] PASS / FAIL: ___

---

### Case 6 — idPrefix만 표시

| | |
|---|---|
| **확인** | 페이지에 `User id prefix: xxxxxxxx` (8자) |
| **금지** | full UUID 전체 노출 |

- [ ] PASS / FAIL: ___

---

### Case 7 & 8 — Session API

**경로:** DevTools (F12) → **Console** — 로그인 상태에서 실행:

```js
await fetch("/api/auth/session", { credentials: "include" }).then(r => r.json())
```

**기대 출력 형태:**

```json
{
  "user": {
    "nickname": "...",
    "onboarded": true,
    "idPrefix": "xxxxxxxx"
  }
}
```

**없어야 할 키 (하나라도 있으면 BLOCKED):**

`email`, `token`, `access_token`, `refresh_token`, `id`

- [ ] Case 7 PASS / FAIL: ___
- [ ] Case 8 PASS / FAIL: ___

**붙여넣을 기록용 (값 redact):**

```json
{ "user": { "nickname": "...", "onboarded": true, "idPrefix": "xxxxxxxx" } }
```

---

### Case 9 — Logout

| | |
|---|---|
| **동작** | Settings → **로그아웃** 버튼 |
| **기대** | Network: `POST /api/auth/logout` → 200 |

- [ ] PASS / FAIL: ___

---

### Case 10 — 보호 라우트 리다이렉트

| | |
|---|---|
| **열 URL** | `https://<PREVIEW_HOST>/app/home` |
| **기대** | `/login`으로 리다이렉트 |

- [ ] PASS / FAIL: ___

---

### Case 11 — Mock auth 없음

**새 시크릿 창**에서:

| | |
|---|---|
| **열 URL** | `https://<PREVIEW_HOST>/login` |
| **기대** | "손님으로 시작" / mock 로그인 버튼 **없음** |
| **있으면** | BLOCKED (mock auth exposure) |

- [ ] PASS / FAIL: ___

---

### Case 12 — Reports 503

**다시 로그인한 뒤** DevTools Console:

```js
await fetch("/api/reports", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    targetType: "profile",
    targetId: "smoke-target",
    reason: "staging login smoke"
  })
}).then(async r => ({ status: r.status, body: await r.text() }))
```

**기대:**

```json
{ "status": 503, "body": "..." }
```

- [ ] PASS / FAIL: ___

---

### Case 13 — Alpha BLOCKED

- [ ] P0 migration / RLS / DB answers / unlock DB / blocks 미완 확인
- [ ] **Alpha 여전히 BLOCKED** (PASS여도 동일)

---

## 6. 증거 기록 양식 (복사해서 채우기)

작업 끝나면 이 블록을 메모/이슈/PR 코멘트에 붙여넣기:

````md
## P0-5 Smoke Run

| Field | Value |
|-------|-------|
| Preview URL | |
| Git SHA | dab230e |
| Timestamp UTC | |
| Supabase project | unstandard-staging-*** |
| Tester | |
| Final verdict | PASS / NEEDS FIX / BLOCKED |

### Env names set (values not included)
- UNSTANDARD_SUPABASE_URL: yes/no
- UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: yes/no
- AUTH_COOKIE_SECRET: yes/no
- UNSTANDARD_APP_URL: yes/no
- REPORTS_PERSISTENCE_ADAPTER=disabled: yes/no
- SUPABASE_SERVICE_ROLE_KEY absent: yes/no
- REPORTS_PERSISTENCE_ADAPTER=supabase-alpha absent: yes/no

### Redacted session response
```json
{ "user": { "nickname": "...", "onboarded": true, "idPrefix": "xxxxxxxx" } }
```

### Per-case results

| # | Case | PASS/FAIL | Notes |
|---|------|-----------|-------|
| 1 | /login loads | | |
| 2 | Magic link request | | |
| 3 | Email link callback | | |
| 4 | PKCE to settings | | |
| 5 | Settings loads | | |
| 6 | idPrefix only | | |
| 7 | Session allowed fields | | |
| 8 | Session forbidden absent | | |
| 9 | Logout | | |
| 10 | Protected route redirect | | |
| 11 | Mock auth unavailable | | |
| 12 | Reports 503 | | |
| 13 | Alpha BLOCKED | | |

### Failures

| Step | URL | Status | Error text | Classification |
|------|-----|--------|------------|----------------|
| | | | | |
````

---

## 7. 실패 시 분류 (추측 금지)

| 증상 | 분류 | 조치 |
|------|------|------|
| 링크가 `localhost`로 감 | Supabase redirect / `UNSTANDARD_APP_URL` | 3곳 URL 재정렬, redeploy |
| `auth_callback_failed` | redirect URL / 만료 code | Supabase Redirect URL 확인, 새 링크 |
| `/login` 500 | Vercel env / runtime | Vercel → Deployment → Logs |
| session에 email/token/id | **session API leak** | **BLOCKED** → 코드 PR |
| mock 버튼 보임 | **mock auth exposure** | **BLOCKED** → 코드 PR |
| reports 201 | adapter 켜짐 | Vercel에서 `supabase-alpha` 제거 |
| middleware 500 | Edge runtime | login 후 `VERCEL_PREVIEW_SMOKE.md` |

---

## 8. 당일 타임라인 요약

```text
[ ] 0. 북마크 + 메모장 빈칸 준비
[ ] 1. Supabase API에서 URL + anon key 복사
[ ] 2. openssl로 AUTH_COOKIE_SECRET 생성
[ ] 3. Vercel Preview env 5개 설정 (금지 2개 없는지 확인)
[ ] 4. Preview URL 확정 → UNSTANDARD_APP_URL 입력
[ ] 5. Supabase Email on + Site URL + Redirect URL
[ ] 6. Vercel Redeploy
[ ] 7. Case 1–13 실행 (시크릿 창)
[ ] 8. 증거 양식 채우기
[ ] 9. Verdict: PASS / NEEDS FIX / BLOCKED
```

**예상 소요:** env 설정 15–20분 + redeploy 2–5분 + 실측 15–20분

---

## 9. PASS 후 다음 (오늘은 안 함)

1. `docs/STAGING_LOGIN_SMOKE.md` Record template 업데이트 (별도 docs PR)
2. `docs/VERCEL_PREVIEW_SMOKE.md` Edge middleware 실측
3. Migration + RLS (별도 승인)

**PASS = Preview에서 로그인 문 열림/닫힘 증명. Alpha는 BLOCKED.**
