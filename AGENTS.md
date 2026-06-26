# AGENTS.md

> AI 코딩 에이전트(Cursor, Codex 등) 운영 가이드. 사람용 기여 규칙은 [`CONTRIBUTING.md`](./CONTRIBUTING.md)가 우선합니다.
> **AI는 유능한 인턴이지 프로젝트 오너가 아닙니다. 작게, 안전하게, 리뷰 가능하게.**

## AI 에이전트 작업 규칙
(`cursor/docs-agents-guide-and-readme-fix` 브랜치에서 선별 회수)

### 핵심 규칙
- **한 기능 = 한 브랜치 = 한 에이전트.** 무관한 변경을 같은 브랜치에 섞지 않는다. 브랜치당 PR 하나, 작게 유지.
- **제품 전략 드리프트 금지.** 대학생 쐐기를 제품 정체성으로 하드코딩하지 말 것. 알파/베타·staged reveal 방침은 [`docs/PRODUCT_DIRECTION.md`](./docs/PRODUCT_DIRECTION.md)를 따른다.
- **`sessionStorage` / `localStorage`를 알파-safe source of truth로 쓰지 말 것.** 인증·신고·차단·unlock 진실은 서버 + DB + RLS가 담당한다.
- **P0 안전 게이트 전 고급 기능 금지.** 실제 매칭, 프로덕션 AI Depth Score, 사진 reveal, 결제/수익화는 [`docs/ALPHA_READINESS_CHECKLIST.md`](./docs/ALPHA_READINESS_CHECKLIST.md) P0 통과 후.
- **Supabase를 프로덕션 아키텍처로 취급하지 말 것.** 영속성은 교체 가능한 repository interface 뒤에 둔다 — [`docs/PERSISTENCE_BOUNDARY.md`](./docs/PERSISTENCE_BOUNDARY.md).
- **큰 재작성 금지.** 이미 동작하는 코드/파일은 **재생성하지 말고 그대로 둔다.** 광범위 리팩터링은 별도 브랜치 + 명시적 승인.
- **변경 후 항상 `git diff --stat` / `git diff` 확인** — 의도치 않은 파일이 바뀌지 않았는지 검증.
- **TypeScript strict 유지**, 영리한 추상화보다 단순·유지보수 가능한 코드.
- **빌드/린트/타입체크가 깨진 상태로 작업을 종료하지 않는다.**
- 확신이 없으면 **수정 전에 먼저 질문**한다. 보안·유지보수성이 속도보다 우선.

### 요구되는 응답 흐름
```
1. 진단 (무엇이 문제인가)
2. 구현 계획 (어떻게 고칠 것인가)
3. 변경 예정 파일 목록
4. 위험도 판단
--- (중요 파일은 승인 후) ---
5. 코드 수정
6. 변경 요약 (git diff 기준 설명)
7. 테스트 명령 (정확히 실행 가능한 형태)
8. 예상 결과
9. 롤백 방법
```

### 시크릿 취급
- 실제 값은 `.env.local`(앱) / `.env`(docker)에만. 예시는 `.env.example`로만 관리(`.gitignore`가 `.env`, `.env.*`, `.env*.local` 무시).
- `NEXT_PUBLIC_` 접두어가 붙은 변수만 클라이언트에 노출된다. **서버 전용 키에는 절대 붙이지 않는다.**
- 커밋 전 `git diff`에 키/토큰/비밀번호가 없는지 점검.

### 나쁜 변경 롤백 (비파괴 우선)
```bash
git restore .            # 1) 커밋 전: 작업 트리 되돌리기
git reset --soft HEAD~1  # 2) 커밋 후, 변경은 유지하고 커밋만 취소
git revert <sha>         # 3) push/머지된 변경: 새 커밋으로 되돌림 (공유 브랜치에서 권장)
```
> `git reset --hard` / `git push --force`는 최후의 수단. 공유 브랜치에서는 `git revert`. 자세한 복구 절차는 [`docs/GIT_RECOVERY_LOG.md`](./docs/GIT_RECOVERY_LOG.md).

## Cursor Cloud specific instructions

### What this repo is
Mini-monorepo with two deliverables:
- **Frontend** (repo root): Next.js 15 App Router + React 19 + Tailwind v4, package manager **npm**. This is the user-facing product and is the primary thing to run. Scripts in `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `check`.
- **depth-service** (`services/depth-service`): Python 3.12 FastAPI "Depth Score" microservice. Deps in `requirements.txt`, tests via `pytest` (config in `pyproject.toml`).

### Running the frontend (primary product)
- Standard commands are in `package.json` (`npm run dev` serves on `http://localhost:3000`).
- The frontend runs **fully standalone on mock data** — most data comes from `lib/api/mock-data.ts`. Auth: dev mock uses HttpOnly cookie (`lib/auth/mock-session.server.ts`); production requires Supabase (`middleware.ts` fail-closed). Client reads session via `GET /api/auth/session` (`lib/api/auth.ts`).
- **Important caveat for the answer-unlock flow**: `lib/api/answers.ts` calls the real depth-service only when `NEXT_PUBLIC_API_BASE_URL` is set; otherwise it uses the local `mockVerdict`. The shipped `.env.example` intentionally keeps `NEXT_PUBLIC_API_BASE_URL=` empty for standalone mock mode. If you set it to `http://localhost:8000`, bring up the backend stack first; otherwise the unlock flow's fetch fails and the UI shows verdict `ERROR`.

### depth-service
- Python deps install into a venv at `services/depth-service/.venv` (the update script creates this).
- Run unit tests: `services/depth-service/.venv/bin/python -m pytest` from `services/depth-service`. These are **pure unit tests** and need no DB or embedding server.
- The service can boot standalone (`uvicorn app.main:app`) and `GET /health` works without a DB (the pool is `None` when `DATABASE_URL` is unset). However, `POST /internal/depth/evaluate` requires the TEI embedding server, or it returns 503.

### Full end-to-end depth scoring (heavy / optional)
- `docker-compose.yml` brings up `postgres` (pgvector), `tei` (HuggingFace BAAI/bge-m3 embeddings), and `depth-service`.
- **Docker is not installed in this environment**, and the TEI image downloads a large embedding model on first run. This full stack is **not required** to develop or demo the frontend product, which falls back to mock scoring. Bring it up only when specifically working on real Depth Score behavior.

### System dependency note
- Creating the Python venv requires the `python3-venv` system package (installed during environment setup; not part of the update script).

### Quality gate
- One-shot check: `npm run check` (= `lint` + `typecheck` + `test` + `build`). CI (`.github/workflows/ci.yml`) runs the same checks on Node 20.x/22.x via `npm ci`.
- Keep `package-lock.json` in sync with `package.json` so `npm ci` stays reproducible.

### Git safety rules (강제)
- 파괴적 명령을 먼저 쓰지 말 것. `git reset --hard`, `git clean -fd`, `git push --force`, 브랜치 삭제, 히스토리 재작성은 **명시적 승인** 없이는 금지.
- 되돌릴 때는 비파괴 우선: `git revert <sha>`.
- 현재 작업 브랜치를 임의로 벗어나지 말 것. `main`에 직접 커밋 금지.
- 한 번에 하나의 논리적 변경 = 하나의 커밋. 1 브랜치 = 1 에이전트 (동시에 같은 파일 건드리지 말 것 — 충돌/유실 발생).

### PR 리뷰 체크리스트
- [ ] `npm ci` → `npm run check` 통과(거짓 성공 금지, 실제 실행 결과만 보고)
- [ ] 의도치 않은 파일 변경 없음 (`git diff --stat` 확인). `next-env.d.ts`는 빌드 산출물이므로 커밋하지 말 것
- [ ] `.env*`/시크릿 미노출
- [ ] standalone mock 모드 보존: `.env.example`의 `NEXT_PUBLIC_API_BASE_URL` 기본 빈값 유지
- [ ] 커밋 메시지 컨벤션(`feat|fix|docs|chore|refactor|test:`) 준수

### 아직 만들지 말 것 (do-not-build-yet)
현재 우선순위는 **P0 알파 게이트** → DB 영속·RLS·신고/차단 → 그 다음 제품 확장입니다. 명시적 요청 없이는 아래를 구현하지 말 것:
- 실제 매칭 알고리즘, 추천/개인화
- 프로덕션 AI Depth Score (현재 `lib/depth/evaluate-depth-answer.ts` 결정론적 mock만)
- 사진 reveal, 외모 랭킹, 결제/수익화
- Playwright 등 새 테스트 프레임워크 / 새 dependency
- UI 리팩터, 제품 copy 변경 (전략 문서 승인 없이)

### 알려진 런타임 갭 (백로그, 이번 범위 아님)
- Supabase login UI 미연결 — login 페이지는 dev mock만 (`app/login/page.tsx`)
- Reports: API는 있으나 `lib/server/report-store.server.ts` in-memory (NON-ALPHA-SAFE)
- Unlock: DB source of truth 없음 (signed cookie only)
- Block 기능 미구현
- `lib/api/onboarding-store.ts`: onboarding은 `sessionStorage` (알파-safe 아님)
