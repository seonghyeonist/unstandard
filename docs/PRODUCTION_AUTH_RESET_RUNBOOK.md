# Production Auth Reset Runbook

> **목적:** Vercel Production + Preview에 Supabase 로그인 env를 재설정하고, 고정 도메인으로 magic link 1회 스모크 후 `/app/settings` 진입을 확인한다.  
> **상태 (2026-06-30):** 코드베이스 로컬 검증 통과. Vercel/Supabase 대시보드 작업은 **인간 실행** 필요 (Cloud Agent MCP 미연결).

---

## 0. 현재 기술적 상황 (점검 결과)

| 항목 | 상태 | 비고 |
|------|------|------|
| `main` 브랜치 빌드 | ✅ `npm run check` 통과 | lint + typecheck + 45 tests + build |
| Supabase auth 코드 | ✅ 머지됨 | login, callback, middleware, session API |
| Mock auth (Vercel) | ✅ 비활성 | `NODE_ENV=production` → `isMockAuthAllowed()` false |
| Production fail-closed | ✅ 동작 | Supabase env 없으면 `/app` → `/login?error=auth_not_configured` |
| `AUTH_COOKIE_SECRET` | ⚠️ Vercel에 수동 설정 필요 | production에서 없으면 unlock cookie 서명 throw |
| Vercel Edge middleware | ⚠️ **UNVERIFIED** | 빌드는 성공, 실제 Edge 런타임은 preview/prod에서만 확인 |
| Supabase rate limit | ⏳ 내일 대기 | magic link는 **딱 1회**만 시도 |
| MCP (Vercel/Supabase) | ❌ 미연결 | env 입력·redeploy는 대시보드/CLI로 수행 |

### 인증 플로우 (코드 기준)

```
/login (magic link 요청)
  → signInWithOtp(emailRedirectTo: {UNSTANDARD_APP_URL}/auth/callback)
/auth/callback?code=...
  → exchangeCodeForSession → redirect /app/settings
/app/settings
  → middleware: supabase.auth.getUser() 필수
  → AuthGuard + GET /api/auth/session (idPrefix만 노출)
```

### 고정 도메인이 중요한 이유

`UNSTANDARD_APP_URL`이 없으면 magic link redirect origin이 **요청 Host**(`x-forwarded-host`)에서 결정됩니다.

- Vercel preview URL(`*.vercel.app`)과 커스텀 도메인이 섞이면 Supabase Redirect URL 불일치 → callback 실패.
- **고정 도메인만** 쓰려면 Vercel env + Supabase Site URL + Redirect URLs를 **동일 origin**으로 맞춥니다.

참고: `lib/auth/supabase-request-origin.ts`

---

## 1. 내일 작업 — 5 Vercel env (Production + Preview 둘 다)

아래 **5개**만 이번 스모크에 설정합니다. (`SUPABASE_SERVICE_ROLE_KEY` 등은 넣지 않음.)

| # | Variable | 값 | 필수 |
|---|----------|-----|------|
| 1 | `UNSTANDARD_SUPABASE_URL` | `https://<project-ref>.supabase.co` | ✅ |
| 2 | `UNSTANDARD_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard → API → anon/publishable | ✅ |
| 3 | `UNSTANDARD_APP_URL` | `https://<고정-도메인>` (trailing `/` 없음) | ✅ |
| 4 | `AUTH_COOKIE_SECRET` | 새로 생성 (32+ bytes, 아래 스크립트) | ✅ |
| 5 | `REPORTS_PERSISTENCE_ADAPTER` | `disabled` | ✅ |

**설정하지 않을 것 (이번 작업):**

- `UNSTANDARD_SUPABASE_OAUTH_PROVIDER` — OAuth 스모크 아님
- `SUPABASE_SERVICE_ROLE_KEY` — 로그인 경로 미사용
- `NEXT_PUBLIC_SUPABASE_*` — legacy fallback, 신규 설정 금지
- `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha` — migration/RLS 전 금지

---

## 2. 작업 순서 (내일 그대로 따를 것)

### Step 1 — `AUTH_COOKIE_SECRET` 새로 생성

```bash
chmod +x scripts/generate-auth-cookie-secret.sh
./scripts/generate-auth-cookie-secret.sh
```

- 출력값을 **1Password/비밀 메모**에만 저장. 채팅·이슈·git 커밋 금지.
- 기존 secret을 교체하면 기존 unlock signed cookie는 무효화됨 (의도된 reset).

### Step 2 — Vercel env 5개 재입력 (Production **및** Preview)

**Vercel → Project `unstandard` → Settings → Environment Variables**

각 변수마다:

1. 기존 값이 있으면 **Edit** (또는 삭제 후 재생성).
2. **Environments:** ☑ Production ☑ Preview (둘 다 체크).
3. Step 1에서 생성한 `AUTH_COOKIE_SECRET` 포함 5개 모두 저장.

| 변수 | 체크리스트 |
|------|-----------|
| `UNSTANDARD_SUPABASE_URL` | ☐ Production ☐ Preview |
| `UNSTANDARD_SUPABASE_PUBLISHABLE_KEY` | ☐ Production ☐ Preview |
| `UNSTANDARD_APP_URL` | ☐ Production ☐ Preview — **고정 도메인만** |
| `AUTH_COOKIE_SECRET` | ☐ Production ☐ Preview — **새 값** |
| `REPORTS_PERSISTENCE_ADAPTER` | ☐ Production ☐ Preview — 값 `disabled` |

> Preview에도 동일 `UNSTANDARD_APP_URL`(고정 도메인)을 쓰면 preview 배포가 그 도메인으로 라우팅될 때 redirect가 일치합니다. PR preview URL만 쓸 계획이면 Preview env는 별도 도메인으로 분리하는 편이 낫습니다 — **이번 작업은 고정 도메인만** 기준.

### Step 3 — Supabase: 고정 도메인만

**Supabase Dashboard → Authentication → URL Configuration**

| 필드 | 값 |
|------|-----|
| Site URL | `https://<고정-도메인>` |
| Redirect URLs | `https://<고정-도메인>/auth/callback` |

- `*.vercel.app` 임시 URL은 **제거하거나** 이번 스모크에서 사용하지 않음.
- **Authentication → Providers → Email** 활성화 확인.

### Step 4 — Production redeploy

**Vercel → Deployments → Production 최신 배포 → Redeploy**

- “Use existing Build Cache” **끄기** 권장 (env 변경 반영 확실히).
- Preview도 동일 env를 썼다면 Preview 최신 배포도 Redeploy.

### Step 5 — Rate limit 해제 후 magic link **1회**

Supabase email rate limit이 풀린 뒤:

1. `https://<고정-도메인>/login` 접속.
2. 테스트 이메일 **1회** 입력 → magic link 요청.
3. 메일 링크 클릭 → `/auth/callback?code=...` → `/app/settings` 리다이렉트 확인.

**실패 시 재시도 남발 금지** (rate limit 재발). Vercel Function 로그에서 `requestSupabaseMagicLink` 진단 필드 확인:

- `redirectHost` = 고정 도메인 host
- `hasUnstandardAppUrl: true`

### Step 6 — `/app/settings` 진입 확인

| 확인 | 기대 |
|------|------|
| URL | `https://<고정-도메인>/app/settings` 200 |
| UI | “Authenticated”, 8자 `idPrefix` 표시 |
| DevTools Network | `GET /api/auth/session` 200, `user.idPrefix`만, **email/id/token 없음** |
| 로그아웃 | 버튼 → `/` 이동, `/app/settings` 재접속 시 `/login` redirect |

**배포 직후 (magic link 전) 자동 점검:**

```bash
chmod +x scripts/post-auth-smoke.sh
BASE_URL=https://<고정-도메인> ./scripts/post-auth-smoke.sh
```

---

## 3. 증거 기록 (스모크 후)

[`STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md) 상단 Record template에 채울 것:

- 고정 도메인 URL
- Git SHA (`git rev-parse HEAD`)
- UTC 타임스탬프
- env **이름**만 (값 비공개)
- Case 1–6 pass/fail

---

## 4. 롤백

| 상황 | 조치 |
|------|------|
| env 오설정만 | Vercel 이전 env 복구 → redeploy |
| `AUTH_COOKIE_SECRET`만 문제 | 새 secret 재생성 → redeploy (unlock cookie만 영향) |
| 코드 회귀 | `git revert <sha>` (공유 브랜치) |

```bash
git restore .          # 로컬만 되돌릴 때
git revert <commit>    # 이미 push된 경우
```

---

## 5. 관련 문서·코드

| 문서/경로 | 용도 |
|-----------|------|
| [`STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md) | P0-5 로그인 증거 체크리스트 |
| [`VERCEL_PREVIEW_SMOKE.md`](./VERCEL_PREVIEW_SMOKE.md) | Edge middleware 스모크 |
| [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) | env 이름·마이그레이션 |
| `middleware.ts` | `/app`, `/onboarding` 보호 |
| `app/auth/callback/route.ts` | PKCE → `/app/settings` |
| `scripts/generate-auth-cookie-secret.sh` | secret 생성 |
| `scripts/post-auth-smoke.sh` | 배포 후 curl 스모크 |

---

## 6. Cloud Agent가 미리 해둔 것

- [x] 로컬 `npm run check` 통과 확인
- [x] 본 runbook + secret/smoke 스크립트 추가
- [ ] Vercel env 입력 — MCP/CLI 인증 없음, **내일 대시보드에서 수행**
- [ ] Production redeploy — **내일 수행**
- [ ] Magic link — rate limit 후 **1회**, **내일 수행**
