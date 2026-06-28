# Alpha Readiness Checklist — Unstandard

> **현재 판정: BLOCKED** — 50인 클로즈드 알파 투입 불가.  
> 제품 전략: [`PRODUCT_DIRECTION.md`](./PRODUCT_DIRECTION.md)  
> 보안 상세: [`SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md)

체크리스트는 “완료”가 아니라 **증거**(테스트 로그, Vercel preview URL, migration 적용 스크린샷 등)와 함께 기록한다.

---

## P0 — 50인 알파 전 필수

### 인증·세션

- [ ] Supabase login UI 연결 및 실제 로그인 플로우 테스트 (OAuth 또는 magic link)
- [ ] 서버 측 세션 검증 (`middleware.ts` + API route `requireAuthenticatedUser`)
- [ ] Production에서 mock auth 비활성 (`isMockAuthAllowed() === false`)
- [ ] Vercel preview/prod env 검증 (Supabase URL/anon key, `AUTH_COOKIE_SECRET`)
- [ ] Vercel Edge middleware runtime smoke (`docs/VERCEL_PREVIEW_SMOKE.md`)
- [ ] Service role key가 클라이언트 번들에 없음 (`SUPABASE_SERVICE_ROLE_KEY` server-only)

### 데이터·RLS

- [ ] Supabase migration 적용 (`supabase/migrations/`) — 증거: [`RLS_REPORTS_STAGING_SMOKE.md`](./RLS_REPORTS_STAGING_SMOKE.md) §2
- [ ] RLS 정책 활성화 및 테스트 (`0002_rls_policies.sql`) — 증거: [`RLS_REPORTS_STAGING_SMOKE.md`](./RLS_REPORTS_STAGING_SMOKE.md) §3
- [ ] Reporter profile bootstrap staging smoke (`ensureReporterProfile` + reports insert; nickname not email-derived) — 증거: [`RLS_REPORTS_STAGING_SMOKE.md`](./RLS_REPORTS_STAGING_SMOKE.md) §4–§6
- [ ] DB-backed answers (온보딩·unlock 답변 영속)
- [ ] DB-backed reports via `ReportsRepository` (alpha adapter wired; migration + RLS smoke pending) — 증거: [`RLS_REPORTS_STAGING_SMOKE.md`](./RLS_REPORTS_STAGING_SMOKE.md) §4–§10
- [ ] Block 기능 (`GET/POST/DELETE /api/blocks` + DB + RLS)
- [ ] Unlock state: DB가 source of truth, HttpOnly cookie는 cache만

### 안전·남용 방지

- [ ] 신고·unlock 시도 rate limiting 또는 abuse guard
- [ ] `targetType` / `targetId` 서버 검증 (기존 `report-validation.ts` 유지·확장)
- [ ] XSS: 사용자 입력 React 기본 이스케이프 유지, `dangerouslySetInnerHTML` 없음
- [ ] 로그에 이메일/토큰/원문 답변 미기록

### 품질 게이트

- [ ] `npm ci` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run typecheck` 통과
- [ ] `npm run build` 통과
- [ ] `npm run check` 통과
- [ ] `npm run test` 통과 (현재 13 tests)
- [ ] 모바일 뷰포트 수동 smoke (`docs/MANUAL_TEST_CHECKLIST.md` + 핵심 플로우)

### npm audit (알파 전 결정 기록)

- [ ] PostCSS moderate advisory (Next transitive) — **`npm audit fix --force` 금지** (Next 9로 다운그레이드)
- [ ] 인간 승인: 수용 / Next 업그레이드 대기 / 별도 dependency PR

---

## P1 — 베타(25–39 타깃) 전 권장

### 제품·운영

- [ ] Staged reveal 설정 (질문·답변 단계 vs 사진·기본 사실 단계 분리)
- [ ] 타깃 코호트 분석 (알파 쐐기 vs 베타 25–39 분리)
- [ ] D1/D7 retention instrumentation
- [ ] 채널·유입 source tracking
- [ ] 사용자 피드백 export
- [ ] Admin/moderation review queue
- [ ] 기본 observability (에러·latency)

### 기술 부채

- [ ] Depth BFF: `DEPTH_SERVICE_URL` server-only, `NEXT_PUBLIC_API_BASE_URL` 브라우저 직접 호출 제거
- [ ] Dead code 정리: `lib/api/report-store.ts` (sessionStorage, 미사용)
- [ ] `README.md` / `AGENTS.md`와 실제 auth·report 경로 동기화
- [ ] Invite / allowlist gate

---

## 현재 알려진 갭 (2026-06-24, main @ 4189a9d)

| 항목 | 현재 상태 |
|------|-----------|
| Login UI | Mock session only; Supabase UI 미연결 |
| Reports | `ReportsRepository` + explicit adapter gate; `ensureReporterProfile` before insert when enabled |
| Blocks | 미구현 |
| Unlock | HMAC HttpOnly cookie only (DB 없음) |
| Onboarding answers | `sessionStorage` (`onboarding-store.ts`) — 알파-safe 아님 |
| RLS | Migration 초안만, 미적용 |
| Vercel Edge | Build warning, preview 미실측 |
| PR #9 | Draft maintenance — 별도 판단 필요 |

---

## 판정 규칙

- P0 항목 **하나라도** 미충족 → **BLOCKED**
- P0 전부 충족 + P1 일부 미충족 → **CONDITIONALLY PROCEED** (베타 확장 전 P1 마무리)
- P0 + 필수 P1 + 실측 smoke → **ALPHA-READY** (50인 투입 가능)

> Supabase login UI, DB-backed reports/block/unlock, RLS 검증, Vercel env 검증이 없는데 “알파 준비 완료”라고 말하지 말 것.
