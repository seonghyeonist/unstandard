# Unstandard

> 첫 대화가 달라지면, 사람도 다르게 보인다.

외모 스와이프의 속도는 줄이고, 첫 대화의 밀도는 높이는 **질문 기반 소개팅 웹앱**.
귀찮게 길게 쓰게 하지 않지만, 무의미하게 시작하게도 두지 않습니다.

---

## 프로젝트 현황

| 항목 | 상태 |
|------|------|
| 단계 | MVP 프론트엔드 vertical slice 구현 (mock 데이터 기반) |
| 목표 | 50명 클로즈드 알파 테스트 |
| 배포 | Vercel (예정) |

> 현재 프론트엔드는 **mock 데이터로 단독 실행** 가능합니다. Supabase auth **foundation**(middleware, fail-closed)은 머지되었으나 **login UI·DB 영속·RLS는 미완** — 50인 알파는 **BLOCKED**. 제품 전략: [`docs/PRODUCT_DIRECTION.md`](./docs/PRODUCT_DIRECTION.md) · 게이트: [`docs/ALPHA_READINESS_CHECKLIST.md`](./docs/ALPHA_READINESS_CHECKLIST.md).

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Backend / DB | Supabase (Auth + PostgreSQL + RLS) |
| AI (Depth Score) | BGE-M3 임베딩 + Feature Scoring (로컬) |
| 벡터 검색 | pgvector |
| 배포 | Vercel |

## 로컬 실행

프론트엔드는 백엔드 없이 **mock 모드로 단독 실행**됩니다.

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정 (standalone mock 모드: NEXT_PUBLIC_API_BASE_URL 빈값 유지)
cp .env.example .env.local

# 3. 개발 서버 실행 → http://localhost:3000
npm run dev
```

### 현재 구현된 화면 (vertical slice)

- `/` 랜딩 → `/login` (dev: mock HttpOnly 세션) → `/onboarding` 질문 답변
- `/app/home` 후보 카드 → `/app/answer/[profileId]` 답변으로 프로필 잠금해제
- `/app/profile/[id]`, `/app/chat/[matchId]`, `/app/settings`

데이터는 `lib/api/mock-data.ts`. 인증: dev mock cookie + `GET /api/auth/session`; production은 Supabase env 필수 (`lib/api/auth.ts`, `middleware.ts`).

### 품질 체크

```bash
npm run lint        # ESLint (--max-warnings=0)
npm run typecheck   # tsc --noEmit
npm run build       # next build
npm run check       # 위 셋을 한 번에
```

## 환경변수

> 로컬 mock 개발에 필수인 변수는 적습니다. Production/preview 알파에는 Supabase·`AUTH_COOKIE_SECRET` 등 추가 env가 필요합니다 (`docs/SUPABASE_SETUP.md`).

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `NEXT_PUBLIC_API_BASE_URL` | depth-service 주소. **비우면 mock 모드**. 값을 채우려면 `docker compose` 백엔드 스택을 먼저 실행해야 함(아니면 답변 잠금해제가 ERROR) | ❌ (mock) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production·preview protected routes | ✅ (prod) |
| `AUTH_COOKIE_SECRET` | Unlock signed cookie (production) | ✅ (prod) |

선택적 백엔드 스택(Postgres + TEI 임베딩 + depth-service)은 `docker-compose.yml`로 띄울 수 있으며, 관련 변수는 `.env.example`을 참고하세요.

> **절대로** `.env` 파일이나 API 키를 커밋하지 마세요.

## 브랜치 전략

```
main (보호)          ← 배포 가능한 상태만 유지
  └── dev            ← 통합 개발 브랜치
       ├── feat/xxx      ← 기능 개발
       ├── fix/xxx       ← 버그 수정
       ├── docs/xxx      ← 문서 수정
       └── chore/xxx     ← 설정/도구
```

- `main`에 직접 커밋 금지
- `dev` → `main` 머지 전 lint/build/test 통과 필수

## 커밋 컨벤션

| 접두어 | 용도 | 예시 |
|--------|------|------|
| `feat:` | 새 기능 | `feat: add onboarding question page` |
| `fix:` | 버그 수정 | `fix: resolve login redirect loop` |
| `docs:` | 문서 수정 | `docs: update README with env vars` |
| `chore:` | 설정/빌드 | `chore: add eslint config` |
| `refactor:` | 코드 개선 (동작 변경 없음) | `refactor: extract depth score util` |
| `test:` | 테스트 추가/수정 | `test: add auth flow unit test` |

---

## 🤖 Working with AI Agents

Unstandard는 AI 코딩 에이전트를 활용하여 개발합니다.
**하지만 AI는 유능한 인턴이지, 프로젝트 오너가 아닙니다.**

### 하드 룰

1. **한 번에 하나의 기능만** 구현한다.
2. **전체 리팩터링 금지**. 필요하면 별도 브랜치 + 승인 절차.
3. **파일 삭제 금지**. 삭제 전 이유와 영향 범위를 먼저 설명.
4. **DB 스키마 변경 금지**. migration plan을 먼저 제출.
5. **`.env`, API key, token, secret**은 절대 코드에 하드코딩 금지.
6. 수정 전: 계획 → 수정 → 테스트 명령 → 변경 파일 요약 순서로 답변.
7. 테스트/빌드 실패 상태로 작업을 종료하지 않는다.
8. `git diff` 기준으로 변경 범위를 설명.
9. 보안 관련 기능은 **악마의 대변인 리뷰**를 통과해야 한다.
10. **1 브랜치 = 1 에이전트**. 여러 AI가 한 파일을 동시에 건드리지 않는다.

### AI 에이전트 작업 후 반드시 확인할 것

```bash
# 변경된 파일 확인
git diff --stat

# 변경 내용 상세 확인
git diff

# 빌드 확인
npm run build

# 린트 확인
npm run lint
```

### 나쁜 변경을 되돌리는 방법

```bash
# 커밋 전이라면 - 변경 사항 되돌리기
git checkout -- .

# 커밋 후라면 - 마지막 커밋 취소 (변경 사항은 유지)
git reset --soft HEAD~1

# 커밋 후 변경 사항도 완전히 되돌리려면 (주의!)
git reset --hard HEAD~1
```

> ⚠️ `git reset --hard`와 `git push --force`는 최후의 수단입니다. 실행 전 반드시 현재 상태를 확인하세요.

---

## 개발 우선순위

```
1위: 돌아가는 MVP
2위: 안전한 인증/DB
3위: 배포 가능성
4위: 유지보수성
5위: 고급 AI/Depth Score 통합
```

## 라이선스

Private - All rights reserved.
