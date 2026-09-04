# 2026-09-03 외부 설정·검증 인수인계

## 현재 판정

**TECH_PREPARED_AWAITING_EXTERNAL_ACCOUNTS**

이 상태는 코드·합성 테스트 준비 완료를 뜻하며 Closed Alpha 출시 승인이 아니다. `CLOSED_ALPHA_READY`를 선언하지 않는다.

현재 외부 blocker 코드는 다음과 같다: `BLOCKED_EXTERNAL_GOOGLE_OAUTH`, `BLOCKED_EXTERNAL_NAVER_OAUTH`, `BLOCKED_EXTERNAL_DIDIT_ACCOUNT`, `BLOCKED_EXTERNAL_DIDIT_KOR_DOCUMENT_COVERAGE`, `BLOCKED_EXTERNAL_DIDIT_PRIVACY_FACTS`, `BLOCKED_EXTERNAL_DIDIT_SANDBOX_VALIDATION`. 코드가 존재한다는 이유로 이 항목들을 PASS로 바꾸지 않는다.

## GitHub / Vercel / Neon 상태

- Repository: `seonghyeonist/unstandard`
- 작업 branch: `feat/alpha-profile-identity-20260828`
- 기존 Draft PR: [#80](https://github.com/seonghyeonist/unstandard/pull/80), base `main`; merge하지 않는다.
- 확인된 기존 main/Production 기준 SHA: `0c02fc3224eeec2fcc1cd9f622a44911e51282a5`
- Vercel project: `unstandard-m9qj`; Production deployment는 기존 main SHA로 READY였고 이번 작업에서 secret/배포를 바꾸지 않았다.
- Neon project: `raspy-fog-00907976`; PR 검증 branch `pr80-verification-20260902`는 Production과 분리되어 있다. Production branch에는 migration을 실행하지 않았다.

## 창업자 외부 설정 순서

| 순서 | 해야 할 일 | 완료 증거 |
|---|---|---|
| 1 | Google OAuth app 생성·redirect allowlist·consent screen 확인 | client id만 기록, secret은 secret manager |
| 2 | Naver developer app 생성·profile/email 권한·redirect allowlist 확인 | app id만 기록, secret은 secret manager |
| 3 | Didit sandbox application과 live application을 분리 | application/workflow id와 환경이 일치 |
| 4 | Didit workflow에 ID, passive liveness, face match, IP analysis와 성인 기준을 구성 | workflow export/version 및 한국 문서 subtype 검토 |
| 5 | Didit DPA·subprocessors·region·retention·deletion outcome·가격/한도를 계약으로 확정 | 서명 계약과 내부 privacy/legal 승인 |
| 6 | public HTTPS webhook destination 생성, V3, `status.updated`/`data.updated`, secret 보관 | Try Webhook approved/declined/retry evidence |
| 7 | Vercel Preview 전용 env와 Neon disposable branch를 연결 | env name 목록, DB branch, exact deployed SHA |
| 8 | 합성/승인된 테스트 계정으로 실패·취소·만료·재시도·타인 request·purge pending 검증 | PII 없는 readiness evidence |

## Environment contract

Preview 전용 secret manager에 아래 이름을 넣는다. 대화·GitHub·문서에 값을 붙여넣지 않는다.

```text
UNSTANDARD_IDENTITY_ENABLED=true
DIDIT_API_KEY=<sandbox or explicitly approved environment key>
DIDIT_WORKFLOW_ID=<approved workflow UUID>
DIDIT_WEBHOOK_SECRET=<destination secret>
GOOGLE_CLIENT_ID=<preview OAuth app>
GOOGLE_CLIENT_SECRET=<preview OAuth app secret>
NAVER_CLIENT_ID=<preview OAuth app>
NAVER_CLIENT_SECRET=<preview OAuth app secret>
BETTER_AUTH_SECRET=<preview-only random secret>
BETTER_AUTH_URL=<preview origin>
UNSTANDARD_APP_URL=<preview origin>
DATABASE_URL=<disposable Neon branch only>
UNSTANDARD_RUNTIME_MODE=database
DATABASE_ENV=staging
```

`UNSTANDARD_IDENTITY_ENABLED=true`만으로는 부족하다. 법무/개인정보 고지와 코드 gate가 함께 승인되기 전에는 `IDENTITY_PROVIDER_NOTICE_READY`를 바꾸지 않는다. Production env는 변경하지 않는다.

## 테스트 중 금지사항

- 실제 주민등록번호, 여권번호, 전화번호, 얼굴 이미지/영상, CI/DI를 issue·로그·fixture·문서에 넣지 않는다.
- Didit raw decision을 DB나 evidence JSON에 저장하지 않는다. 허용되는 identity row는 opaque UUID, 상태, version, timestamps뿐이다.
- callback query의 `verificationSessionId`/`status`를 직접 승인 근거로 쓰지 않는다. 로그인한 사용자의 own pending request를 찾아 canonical GET을 한다.
- 404 delete, retention unknown, webhook signature failure, age/date malformed는 모두 fail closed다.
- Production DB migration, Production secret, main merge, 실사용자 초대, live 인증은 별도 승인 전 금지한다.

## 승인 후 순서와 rollback

1. 창업자가 OAuth·Didit 계정/계약·고지·비용·로그 보존을 체크한다.
2. disposable Neon branch에서 migration 0011과 repository 동시성/삭제/cascade를 검증한다. Production branch에는 적용하지 않는다.
3. Preview exact-SHA deploy에서 Google/Naver invite gate와 Didit sandbox 합성 시나리오를 검증한다.
4. 실패하면 Vercel deployment를 이전 검증 SHA로 되돌리고, Didit workflow/destination을 별도로 disable/rotate한다.
5. 운영 적용 후 provider session 삭제와 DB `provider_purged_at` 상태를 대조한다. 코드 rollback만으로 외부 provider 데이터가 삭제됐다고 보지 않는다.
