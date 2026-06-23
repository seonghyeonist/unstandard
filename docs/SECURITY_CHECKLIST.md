# Security Checklist — Unstandard Closed Alpha

> **현재 상태:** mock/sessionStorage MVP. 이 문서는 50인 클로즈드 알파 전 보안 게이트입니다.
> mock 모드는 **데모용**이며, 실사용자 투입 전 Supabase Auth + 서버 검증 + RLS가 **필수**입니다.

## A. Executive gate (알파 투입 전)

| 게이트 | 현재 | 알파 전 필수 |
|--------|------|--------------|
| 실제 인증 (Supabase Auth) | ❌ sessionStorage mock | ✅ |
| 서버 측 unlock 판정 | ❌ 클라이언트 Set | ✅ |
| 프로필 비공개 필드 서버 분리 | ❌ JS 번들 포함 | ✅ |
| 신고 서버 영속 + 중재 파이프라인 | ❌ sessionStorage only | ✅ |
| 차단(block) 기능 | ❌ 미구현 | ✅ |
| RLS on all private tables | ❌ 마이그레이션 초안만 | ✅ |
| depth-service 브라우저 직접 호출 차단 | ⚠️ `NEXT_PUBLIC_API_BASE_URL` 시 노출 | ✅ BFF/Route Handler |
| Service role key 클라이언트 미사용 | ✅ (아직 미연동) | ✅ |

**판정:** mock 단독으로 실사용자 50인 투입 → **차단(Blocked)**.  
mock + 문서화된 한계 인지 + Supabase/RLS 착수 → **다음 단계 진행 가능(High risk)**.

---

## B. Mock-only trust boundaries (절대 잊지 말 것)

1. **`lib/api/auth.ts`** — `sessionStorage`에 사용자 JSON 저장. DevTools로 `onboarded:true` 주입 시 AuthGuard 우회.
2. **`lib/api/answers.ts`** — unlock 상태는 메모리 `Set`. 새로고침 시 초기화. 판정 로직은 브라우저에서 실행 가능.
3. **`lib/api/mock-data.ts` + `profiles.ts`** — `unlocked.letter` 등이 번들에 포함. blur는 CSS일 뿐, 데이터는 이미 클라이언트에 있음.
4. **`lib/api/report-store.ts`** — 신고는 탭 `sessionStorage`에만 저장. 서버/운영자에게 전달되지 않음.
5. **`middleware.ts` 없음** — `/app/*` 보호는 클라이언트 `AuthGuard` 리다이렉트뿐.
6. **`app/api/**` 없음** — 서버 검증 레이어 없음.

---

## C. Environment & secrets

- [ ] `.env.local` / `.env` 커밋 금지 (`.gitignore` 확인)
- [ ] `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 — **절대** `NEXT_PUBLIC_` 접두어 금지
- [ ] Vercel Production / Preview env 분리 설정 (`docs/SUPABASE_SETUP.md` 참고)
- [ ] `NEXT_PUBLIC_API_BASE_URL`은 공개 URL — internal depth 경로를 브라우저에서 직접 호출하지 말 것
- [ ] docker-compose 기본 `localdev` 비밀번호를 운영에 사용 금지

---

## D. Client/server boundary

- [ ] `dangerouslySetInnerHTML` / `innerHTML` / `eval` 사용 없음 유지
- [ ] 사용자 입력(답변, 메시지, 닉네임)은 React 기본 이스케이프로 렌더
- [ ] `process.env`는 `NEXT_PUBLIC_*`만 클라이언트 번들에 포함되는지 확인
- [ ] 에러 UI에 stack trace / env 값 노출 금지

---

## E. Data & privacy

- [ ] `console.log`로 답변/이메일/토큰 로깅 금지
- [ ] 온보딩 답변(`answerText`)은 sessionStorage에 저장됨 — 공유 PC/XSS 시 노출
- [ ] depth 평가 `score`/`path`/`modelVersion`은 UI 미노출, sessionStorage에는 존재
- [ ] 알파 종료 후 사용자 데이터 삭제/보내기 절차 문서화 (백로그)

---

## F. Reports & safety (P1 before alpha)

- [ ] `reportTarget` 서버 API + DB 영속
- [ ] `targetType` / `targetId` 서버 검증
- [ ] 신고 rate limit (서버)
- [ ] **block** 기능 구현 — 현재 없음
- [ ] 신고자는 자신의 신고만 조회 가능 (RLS)

---

## G. RLS minimum (Supabase 도입 시)

`supabase/migrations/0002_rls_policies.sql` 초안 기준:

| Table | Normal user SELECT | INSERT | UPDATE own | DELETE |
|-------|-------------------|--------|------------|--------|
| profiles | public fields only | own | own | — |
| answers | own only | own | own | — |
| depth_evaluations | own only | system | — | — |
| reports | own reports only | own | — | — |
| blocks | own blocks | own | — | own |
| app_config | safe keys only | — | — | — |
| events | own only | own | — | — |
| messages | conversation member | own | — | — |

---

## H. Verification commands

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run check
npm audit --audit-level=moderate || true
```

Mock E2E (백엔드 없이):

```bash
NEXT_PUBLIC_API_BASE_URL= npm run dev
```

수동 확인: 약한 답 잠금 유지, 구체적 답 unlock, 신고 sessionStorage 기록, UI에 score/Depth Score/path 미노출.

---

## I. P1 before 50-person alpha (구현 순서)

1. Supabase Auth + `middleware.ts` 세션 검증
2. RLS 마이그레이션 적용 + adapter 교체
3. Unlock/depth 판정 서버 이전 (BFF)
4. 프로필 비공개 필드 서버 분리
5. 신고/차단 서버 영속
6. depth-service 내부 네트워크 격리 + 인증
