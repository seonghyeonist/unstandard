# AGENTS.md

> AI 코딩 에이전트 운영 가이드. 사람용 기여 규칙은 [`CONTRIBUTING.md`](./CONTRIBUTING.md)가 우선합니다.

## 핵심 규칙

- **한 기능 = 한 브랜치 = 한 에이전트.**
- **영속성은 repository interface 뒤에 둔다** — [`docs/PERSISTENCE_BOUNDARY.md`](./docs/PERSISTENCE_BOUNDARY.md).
- **`sessionStorage` / `localStorage`를 알파-safe source of truth로 쓰지 말 것.**
- **데이터베이스 접근은 server-only.** 클라이언트 번들에 Drizzle/Neon/비밀 env 금지.
- **Preview/Production에서 mock auth 금지.** `UNSTANDARD_RUNTIME_MODE=database` 필수.
- **빌드 중 자동 migration 금지.** `db:migrate`는 명시적 확인 env 필요.
- **변경 후 `git diff --stat` 확인**, `npm run check` 통과 후 종료.

## 로컬 실행

- 프론트엔드: `npm run dev` (mock 기본)
- DB 백엔드: `docs/NEON_BOOTSTRAP_RUNBOOK.md`
- 품질 게이트: `npm run check`, `npm run guard:no-legacy-backend`, `npm run guard:boundaries`

## 알파 상태

**BLOCKED** — Neon staging DB, migration apply, `test:integration`, `smoke:authorization` 증거 필요.

## do-not-build-yet

- 실제 매칭/추천, 프로덕션 AI Depth Score, 사진 reveal, 결제, 벡터 인프라
