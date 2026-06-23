# Handoff — Unstandard (end-of-day snapshot)

> 마지막 업데이트: **2026-06-23 (end-of-day)**  
> 목적: PR #11 foundation 랜딩 준비 + 내일 이어갈 작업 컨텍스트

---

## 1. Executive state

| 질문 | 답 |
|------|-----|
| PR #11 merged? | **NO** — 인간 머지 대기 |
| PR #11 foundation-ready? | **YES** — 로컬·CI 검증 통과 (`12ef513`) |
| Alpha-ready? | **NO — BLOCKED** |
| Vercel Edge smoke? | **UNVERIFIED** — preview 미실측 |

---

## 2. Branch / commit

| 항목 | 값 |
|------|-----|
| **현재 작업 브랜치** | `cursor/p0-supabase-auth-foundation` |
| **PR #11 HEAD** | `12ef513d4fb89dc24fdb3f12576bfa16b24f2df0` |
| **main (pre-#11)** | `9db9faf` |
| **PR #11** | https://github.com/seonghyeonist/unstandard/pull/11 |

### PR #11 커밋

```
12ef513 docs: add session handoff snapshot for P0 auth foundation work
882b59d fix: harden PR #11 fail-closed auth and unlock boundaries
1aa22aa feat: add Supabase auth foundation and server-side trust boundaries
```

---

## 3. PR 큐 (2026-06-23 EOD)

| PR | 상태 | Mergeable | 권장 조치 |
|----|------|-----------|-----------|
| **#11** | OPEN, not draft | ✅ MERGEABLE | **인간 리뷰 후 squash merge** |
| **#9** | OPEN, draft | ✅ MERGEABLE | **#11 머지 후** template/README만 cherry-pick |
| **#8** | OPEN, draft | ❌ CONFLICTING | **수동 close** (토큰 권한 없음) |

### PR #8 수동 close

1. https://github.com/seonghyeonist/unstandard/pull/8
2. 코멘트: *Closing as superseded/conflicting. Core repo health repair has already been handled elsewhere. Branch not deleted.*
3. Close PR (브랜치 `cursor/automated-github-health-2d81` 삭제 금지)

### PR #9 (#11 이후)

- Cherry-pick 대상: `.github/PULL_REQUEST_TEMPLATE.md`, `README.md`
- **충돌 주의:** `docs/TROUBLESHOOTING.md` — #11과 양쪽 수정, blind merge 금지
- `next-env.d.ts` 삭제는 현재 repo 정책(빌드 산출물, eslint ignore)과 충돌 가능 — cherry-pick 제외 권장

---

## 4. 검증 명령 및 결과 (2026-06-23 EOD, 재실행)

브랜치: `cursor/p0-supabase-auth-foundation` @ `12ef513`

| Command | Result | Notes |
|---------|--------|-------|
| `npm ci` | ✅ pass | |
| `npm run test` | ✅ 13/13 pass | |
| `npm run lint` | ✅ pass | |
| `npm run typecheck` | ✅ pass | |
| `npm run build` | ✅ pass | Supabase Edge warning (see below) |
| `npm run check` | ✅ pass | |
| `npm audit --audit-level=moderate` | ⚠️ exit 1 | 2 moderate PostCSS via Next — known, `fix --force` 금지 |
| `git status` (post-check) | ✅ clean | `next-env.d.ts` dirty → `git restore` 적용 |

### GitHub CI (PR #11 head)

- `build (20.x)` ✅ SUCCESS
- `build (22.x)` ✅ SUCCESS

### Build warning (무해 단정 금지)

```
@supabase/supabase-js ... process.version ... not supported in the Edge Runtime
```

→ **`docs/VERCEL_PREVIEW_SMOKE.md`** 체크리스트로 Vercel preview 실측 필수. 현재 **UNVERIFIED**.

### `next-env.d.ts`

`npm run build` 후 `/// <reference path="./.next/types/routes.d.ts" />` 추가됨. **커밋 금지.** `git restore next-env.d.ts`.

---

## 5. PR #11 보안 해머 리뷰 요약

| Area | Verdict | Evidence |
|------|---------|----------|
| Production auth fail-closed | **PASS** | `middleware.ts` L18–24, `auth-production.ts` |
| Mock auth production block | **PASS** | `isMockAuthAllowed()` → false in production |
| AuthGuard = UX only | **PASS** | Middleware + API routes enforce; AuthGuard client-only |
| Supabase secret boundary | **PASS** | `admin.ts` server-only; no client service-role imports |
| Private profile boundary | **PASS** | `mock-public.ts` no letters; private via `/api/profile/.../private` |
| Unlock signature | **PASS** | HMAC `profileId:userId`; tests in `auth-boundary.test.ts` |
| Unlock persistence | **FAIL (alpha)** | Cookie-only authority — foundation-only, NOT alpha-safe |
| Report API auth | **PASS** | 401 unauthenticated; session reporter id |
| Report persistence | **FAIL (alpha)** | `report-store.server.ts` in-memory — NON-ALPHA-SAFE |
| Depth browser direct call | **PASS** | Browser → `/api/answers/unlock` only |
| Depth env naming | **DEBT** | `NEXT_PUBLIC_API_BASE_URL` in server route via `lib/api/client.ts` — BFF next branch |
| Edge middleware | **UNVERIFIED** | Build warning; Vercel runtime not tested |

**Final verdict:** **MERGEABLE AS FOUNDATION — NOT ALPHA READY**

---

## 6. PR #11 인간 머지 절차

Cloud Agent 토큰: **merge 권한 미확인 / 명시적 머지 지시 없음** → 자동 머지 안 함.

```bash
# 1. GitHub UI
#    https://github.com/seonghyeonist/unstandard/pull/11
#    - Checks green 확인
#    - Squash merge (권장)
#    - Title: P0: Add Supabase auth foundation and server-side trust boundaries

# 2. 로컬 동기화
git checkout main
git pull --ff-only origin main
npm ci && npm run check
git restore next-env.d.ts   # if dirty
git status --short          # must be clean
```

---

## 7. Remaining alpha blockers

1. Supabase login UI (OAuth/magic link) — login page mock-only
2. Invite / allowlist gate
3. Reports DB persistence (in-memory → Supabase)
4. Block API + DB persistence
5. Unlock DB source of truth (cookie → cache only)
6. Depth BFF — `DEPTH_SERVICE_URL` server-only, remove `NEXT_PUBLIC_` pattern
7. **Vercel Edge middleware runtime smoke** — UNVERIFIED
8. Rate limiting
9. Moderation / admin workflow
10. Known `npm audit` PostCSS moderate (transitive via Next)
11. Supabase migrations + RLS applied in real project
12. Dead code: `lib/api/report-store.ts` (sessionStorage, unused)

---

## 8. Next branch (명시적 승인 후)

| 항목 | 값 |
|------|-----|
| **Branch** | `cursor/p0-block-report-unlock-persistence-1e2a` |
| **Prerequisite** | PR #11 merged to `main` |

### Scope

- Reports → Supabase `reports` table + RLS
- Blocks → `GET/POST/DELETE /api/blocks` + DB
- Unlock → DB source of truth; cookie cache only
- Depth BFF → `POST /api/depth/evaluate`, server-only `DEPTH_SERVICE_URL`

### Out of scope

- Vector DB / Supabase pgvector production workload
- Local AI / LLM judge
- Matching / chat / payments
- UI redesign
- Supabase login UI (별도 브랜치)

---

## 9. 아키텍처 스냅샷 (PR #11)

```
[Browser]
  ├─ getCurrentUser() → GET /api/auth/session
  ├─ submitUnlockAnswer() → POST /api/answers/unlock
  ├─ getUnlockStatus() → GET /api/unlock/[profileId]
  ├─ getPrivateProfile() → GET /api/profile/[id]/private
  └─ reportTarget() → POST /api/reports

[Server]
  ├─ Mock dev: HttpOnly unstandard_mock_session
  ├─ Supabase (env set): middleware + createServerClient
  ├─ Unlock: signed HttpOnly unstandard_unlock_{profileId}
  └─ Reports: in-memory array (NON-ALPHA-SAFE)

[Production rules]
  ├─ isMockAuthAllowed() === false
  ├─ middleware blocks /app,/onboarding if Supabase env missing
  └─ AUTH_COOKIE_SECRET required for unlock cookies
```

---

## 10. 주요 파일 맵

| 경로 | 역할 |
|------|------|
| `middleware.ts` | Supabase 세션 + production fail-closed |
| `lib/config/auth-production.ts` | `isProductionAuthConfigured()` |
| `lib/auth/server.ts` | `getAuthenticatedUser`, `requireAuthenticatedUser` |
| `lib/server/unlock-signature.ts` | HMAC sign/verify (testable) |
| `lib/server/report-store.server.ts` | in-memory reports (NON-ALPHA-SAFE) |
| `lib/data/mock-public.ts` | client-safe public profiles |
| `lib/data/mock-private.server.ts` | server-only private letters |
| `tests/auth-boundary.test.ts` | fail-closed + unlock + report tests |
| `docs/VERCEL_PREVIEW_SMOKE.md` | Vercel preview 체크리스트 (NEW) |
| `docs/SECURITY_CHECKLIST.md` | 알파 게이트 |

---

## 11. 롤백

### PR #11 머지 전 (브랜치만 폐기)

```bash
# main untouched — close PR #11 without merge
```

### PR #11 squash merge 후

```bash
git checkout main
git pull --ff-only
git revert -m 1 <merge_commit_sha>
npm ci && npm run check
```

### hostile fixes만 되돌리기 (머지 전 브랜치)

```bash
git revert 882b59d
```

### env 롤백

- Vercel/`.env.local`에서 Supabase vars 제거 → production fail-closed (의도된 동작)
- `AUTH_COOKIE_SECRET` 제거 → unlock fail-closed in production

---

## 12. Git 안전 규칙

- main 직접 push 금지
- `git reset --hard`, `git push --force` 금지
- `next-env.d.ts` 커밋 금지
- `.env.local` / 시크릿 커밋 금지
- 브랜치 삭제 명시적 승인 없이 금지

---

## 13. 링크

- PR #11: https://github.com/seonghyeonist/unstandard/pull/11
- PR #9: https://github.com/seonghyeonist/unstandard/pull/9
- PR #8: https://github.com/seonghyeonist/unstandard/pull/8
- Vercel smoke doc: `docs/VERCEL_PREVIEW_SMOKE.md`
