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
- **P0.4D AI adjudication 작업 전** [`docs/P0_4D_AI_ADJUDICATION_CURSOR_WORKSHEET.md`](./docs/P0_4D_AI_ADJUDICATION_CURSOR_WORKSHEET.md)를 읽는다. AI-only offline labels는 human ground truth나 readiness 증거로 승격하지 않는다.
- **P0.4E Local AI / gate 경계 작업 전** [`docs/P0_4E_LOCAL_AI_PROVENANCE_AND_GATE_BOUNDARY.md`](./docs/P0_4E_LOCAL_AI_PROVENANCE_AND_GATE_BOUNDARY.md)를 읽는다. AI adjudication 완료는 Local AI 실행·calibration·alpha readiness 승인이 아니다.
- **P0.4F Local AI preflight 작업 전** [`docs/P0_4F_LOCAL_AI_PREFLIGHT_RUNBOOK.md`](./docs/P0_4F_LOCAL_AI_PREFLIGHT_RUNBOOK.md)를 읽는다. Preflight 문서만으로는 실행·calibration·readiness가 승인되지 않는다.

## 로컬 실행

- 프론트엔드: `npm run dev` (mock 기본)
- DB 백엔드: `docs/NEON_BOOTSTRAP_RUNBOOK.md`
- 품질 게이트: `npm run check`, `npm run guard:no-legacy-backend`, `npm run guard:boundaries`

## 알파 상태

**CONDITIONAL / REATTESTATION_REQUIRED** — Production은 SHA
`0c02fc3224eeec2fcc1cd9f622a44911e51282a5`에서 READY이고 migration
`0000`–`0008`, 공개 법적 고지, support/report/delete/restore drill, canonical
domain 및 메일함 검증까지 완료됐다. 한국어 브랜드 표기는 창업자 결정으로
`언스탠다드`다. 2026-08-25의 마지막 v4 gate는 domain disposition 전 9/10이었고,
2026-08-26 founder disposition 이후에는 **새로운 6시간 이내 Production evidence와
동일 SHA attestation으로 gate를 다시 실행하기 전** 초대를 발행하지 않는다. 현재 절차는
[`docs/CLOSED_ALPHA_STAGE1_RUNBOOK.md`](./docs/CLOSED_ALPHA_STAGE1_RUNBOOK.md)를 따른다.

## do-not-build-yet

- 실제 매칭/추천, 프로덕션 AI Depth Score, 사진 reveal, 결제, 벡터 인프라
