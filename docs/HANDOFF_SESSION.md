# Handoff — Unstandard (새 창/세션용)

> 마지막 업데이트: 2026-06-23  
> 저장 목적: Cursor Cloud Agent 작업 컨텍스트를 새 창에서 이어가기 위한 스냅샷

---

## 1. 저장소 / 브랜치

| 항목 | 값 |
|------|-----|
| Repo | https://github.com/seonghyeonist/unstandard |
| **현재 작업 브랜치** | `cursor/p0-supabase-auth-foundation` |
| main 최신 (PR #10 머지 후) | `9db9faf` |
| PR #11 HEAD | `882b59d` |

### 최근 커밋 (PR #11 브랜치)

```
882b59d fix: harden PR #11 fail-closed auth and unlock boundaries
1aa22aa feat: add Supabase auth foundation and server-side trust boundaries
```

### 로컬 시작 명령

```bash
git fetch origin --prune
git checkout cursor/p0-supabase-auth-foundation
git pull origin cursor/p0-supabase-auth-foundation
npm ci
npm run test && npm run check
```

---

## 2. PR 큐 상태 (2026-06-23)

| PR | 상태 | 브랜치 | 권장 |
|----|------|--------|------|
| **#6** | ✅ MERGED | `cursor/automated-github-health-a0f4` | eslint `next-env.d.ts` ignore |
| **#7** | ✅ MERGED | `feat/report-persistence-and-verdict-copy` | report persistence + reasonCode copy |
| **#8** | OPEN / DRAFT / **CONFLICTING** | `cursor/automated-github-health-2d81` | **수동 close** (#6 중복). template/README cherry-pick 검토 |
| **#9** | OPEN / DRAFT / MERGEABLE | `cursor/automated-github-health-2c18` | #11 머지 후 template/README만 cherry-pick 검토 |
| **#10** | ✅ MERGED | `cursor/security-alpha-prep-9d93` | SECURITY_CHECKLIST, RLS draft, report validation |
| **#11** | OPEN / **ready for review** / MERGEABLE | `cursor/p0-supabase-auth-foundation` | **인간 리뷰 후 머지 가능** (foundation만, 알파 아님) |

**주의:** `gh pr close` / `gh pr comment` — Cloud Agent token 권한 부족으로 실패한 이력 있음. 사람이 수동 처리.

---

## 3. Executive verdict

| 질문 | 답 |
|------|-----|
| PR #11 merge-ready? | **인간 리뷰용 ready** (`gh pr ready 11` 완료). 자동 머지 아님. |
| 50인 알파 ready? | **NOT alpha-ready. BLOCKED.** |
| mock/sessionStorage 실보안? | **아님.** dev mock = HttpOnly cookie theater. |

---

## 4. PR #10 (merged) — 요약

- `docs/SECURITY_CHECKLIST.md`, `docs/SUPABASE_SETUP.md`, `docs/DB_SCHEMA_DRAFT.md`
- `supabase/migrations/0001_initial_schema.sql`, `0002_rls_policies.sql` (초안, 미적용)
- `lib/api/reports.ts` — targetType/id/reason 검증
- `.gitignore` env 패턴 확장

---

## 5. PR #11 — 구현 내용

### 5.1 커밋 `1aa22aa` (foundation)

**의존성 추가:**
- `@supabase/supabase-js`, `@supabase/ssr`, `server-only`
- dev: `tsx` (테스트용)

**Supabase 분리:**
- `lib/supabase/client.ts` — browser, anon key only
- `lib/supabase/server.ts` — server session cookies
- `lib/supabase/admin.ts` — service role, `server-only`

**Auth:**
- `middleware.ts` — Supabase env 있을 때 `/app/*`, `/onboarding` 세션 검증
- `lib/config/auth-mode.ts` — mock dev-only, production mock 금지
- `lib/auth/mock-session.server.ts` — HttpOnly `unstandard_mock_session`
- `app/login/actions.ts` — `startMockSession`, `completeMockOnboarding`

**Private data 분리:**
- `lib/data/mock-public.ts` — public card only (letter 없음)
- `lib/data/mock-private.server.ts` — server-only private letters

**Server API routes:**
- `GET /api/auth/session`
- `POST /api/answers/unlock`
- `GET /api/unlock/[profileId]`
- `GET /api/profile/[id]/private`
- `POST /api/reports`

**Unlock:** signed HttpOnly cookies (`lib/server/unlock-cookies.ts`)

**Reports:** in-memory `lib/server/report-store.server.ts` (**NON-ALPHA-SAFE**)

**Tests:** 7개 (`lib/**/*.test.ts`)

### 5.2 커밋 `882b59d` (hostile review fixes)

| 수정 | 파일 |
|------|------|
| Production fail-closed middleware | `middleware.ts`, `lib/config/auth-production.ts` |
| sessionStorage auth **전면 제거** | `lib/api/auth.ts` |
| Logout → server cookie 삭제 | `endMockSession`, `app/app/settings/page.tsx` |
| Unlock signature 분리 + production secret 필수 | `lib/server/unlock-signature.ts` |
| auth-boundary 테스트 6개 추가 | `tests/auth-boundary.test.ts` |
| Edge warning / in-memory reports 문서화 | `docs/TROUBLESHOOTING.md`, `docs/SECURITY_CHECKLIST.md` |

**테스트:** 7 → **13** pass

---

## 6. PR #11 hostile review — 원본 결함 vs 수정

### 수정됨 (882b59d)

| ID | 결함 | 수정 |
|----|------|------|
| C1 | middleware production fail-open | production + no Supabase → `/login?error=auth_not_configured` |
| C2 | sessionStorage auth fallback | `/api/auth/session` only |
| H1 | logout server cookie 미삭제 | `endMockSession` |
| H2 | AUTH_COOKIE_SECRET production 테스트 없음 | `tests/auth-boundary.test.ts` |
| H3 | unlock viewer binding 테스트 없음 | `verifyUnlockToken` tests |

### 미수정 (다음 브랜치)

| ID | 결함 |
|----|------|
| H4 | Reports in-memory only — Supabase persistence 필요 |
| H5 | Supabase login UI 없음 |
| — | block 기능 없음 |
| — | unlock DB persistence 없음 (cookie only) |
| M1 | Middleware Edge runtime warning — **Vercel preview 미검증** |
| M3 | depth-service browser 직접 호출 (`NEXT_PUBLIC_API_BASE_URL`) |
| — | invite/allowlist gate 없음 |

---

## 7. 아키텍처 스냅샷 (PR #11)

```
[Browser]
  ├─ getCurrentUser() → GET /api/auth/session (credentials: include)
  ├─ submitUnlockAnswer() → POST /api/answers/unlock
  ├─ getUnlockStatus() → GET /api/unlock/[profileId]
  ├─ getPrivateProfile() → GET /api/profile/[id]/private
  └─ reportTarget() → POST /api/reports

[Server]
  ├─ Mock dev: HttpOnly cookie unstandard_mock_session
  ├─ Supabase (when env set): middleware + createServerClient
  ├─ Unlock: HttpOnly signed cookie unstandard_unlock_{profileId}
  └─ Reports: in-memory array (ephemeral)

[Production rules]
  ├─ isMockAuthAllowed() === false
  ├─ middleware blocks /app if Supabase env missing
  └─ AUTH_COOKIE_SECRET required for unlock cookies
```

### 환경 변수 (.env.example)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only, never NEXT_PUBLIC_
AUTH_COOKIE_SECRET=                 # required in production for unlock
NEXT_PUBLIC_API_BASE_URL=           # empty = mock depth; if set → server calls depth-service
```

---

## 8. 검증 명령 (마지막 통과)

```bash
npm ci
npm run test      # 13 pass
npm run lint      # pass
npm run typecheck # pass
npm run build     # pass (Edge warning below)
npm run check     # pass
npm audit --audit-level=moderate  # 2 moderate postcss via next, exit 1
```

### 빌드 경고 (무해 단정 금지)

```
@supabase/supabase-js ... process.version ... not supported in the Edge Runtime
Import trace: @supabase/ssr → createBrowserClient.js
```

→ Vercel preview에서 middleware runtime 오류 여부 **반드시 실측** 필요.

### 생성 파일 주의

`next-env.d.ts` — 빌드 후 변경됨. **커밋 금지.** `git restore next-env.d.ts`

---

## 9. 주요 파일 맵

| 경로 | 역할 |
|------|------|
| `middleware.ts` | Supabase 세션 + production fail-closed |
| `lib/config/auth-mode.ts` | server auth mode flags |
| `lib/config/auth-mode-client.ts` | client-safe flags |
| `lib/config/auth-production.ts` | `isProductionAuthConfigured()` |
| `lib/auth/server.ts` | `getAuthenticatedUser`, `requireAuthenticatedUser` |
| `lib/auth/mock-session.server.ts` | mock HttpOnly session |
| `lib/server/unlock-signature.ts` | pure HMAC sign/verify (testable) |
| `lib/server/unlock-cookies.ts` | Next.js cookie wrapper |
| `lib/security/report-validation.ts` | report input validation |
| `lib/data/mock-public.ts` | client-safe public profiles |
| `lib/data/mock-private.server.ts` | server-only private letters |
| `lib/server/report-store.server.ts` | in-memory reports (NON-ALPHA-SAFE) |
| `tests/auth-boundary.test.ts` | fail-closed + unlock + report tests |
| `docs/SECURITY_CHECKLIST.md` | 알파 게이트 |
| `docs/SUPABASE_SETUP.md` | env / Vercel 분리 |
| `supabase/migrations/*.sql` | schema + RLS 초안 (미적용) |

---

## 10. 다음 작업 (명시적 승인 후)

### 브랜치명 (계획)

`cursor/p0-block-report-unlock-persistence`

### Scope

1. **Supabase report persistence** — `reports` table INSERT, RLS, reporter from session only
2. **Block API** — POST/DELETE/GET `/api/blocks`
3. **Unlock DB persistence** — `unlocks` table, cookie는 cache만
4. **depth BFF** — `POST /api/depth/evaluate`, browser에서 internal depth 직접 호출 제거
5. **Tests** — block, report DB, unlock forgery, BFF fallback
6. **Docs** — SECURITY_CHECKLIST, SUPABASE_SETUP, TROUBLESHOOTING 갱신

### Out of scope

- Local AI / real depth scoring
- Matching algorithm
- Chat / payment
- UI redesign
- invite/allowlist gate (별도)
- `npm audit fix --force`

### PR #11 머지 전 체크리스트

- [ ] 인간 리뷰: middleware fail-closed 동작
- [ ] 인간 리뷰: private API 403 without unlock
- [ ] Vercel preview: middleware Edge runtime
- [ ] PR #8 수동 close 여부 결정
- [ ] PR #9 cherry-pick 여부 결정

---

## 11. Git 안전 규칙 (리마인더)

- main에 직접 push 금지
- `git reset --hard`, `git clean -fd`, `git push --force` 금지
- 브랜치 삭제 명시적 승인 없이 금지
- `next-env.d.ts` 커밋 금지
- `.env.local` 커밋 금지
- `SUPABASE_SERVICE_ROLE_KEY` 클라이언트 노출 금지

---

## 12. 롤백

```bash
# PR #11 hostile fixes만
git revert 882b59d

# PR #11 전체 (머지 후)
git revert 882b59d
git revert 1aa22aa

npm ci && npm run check
```

---

## 13. 링크

- PR #11: https://github.com/seonghyeonist/unstandard/pull/11
- PR #10 (merged): security prep
- AGENTS.md: 에이전트 운영 규칙
- CONTRIBUTING.md: 사람용 기여 규칙
