# UNSTANDARD Founder Closed Alpha Stage 1 인수인계 — 2026-08-12

## 0. 결론

| 판정면 | 현재 판정 |
|---|---|
| Founder 제안의 실행 계약화 | `PASS` |
| 로컬 정적·단위·빌드 | `PASS` |
| 최신 소스의 격리 Neon 검증 | `PASS_DIAGNOSTIC` — 17/17 tests, 27/27 required cases |
| GitHub exact-head CI | `PUBLISHED / PENDING_CI` |
| Vercel exact-head Preview full-flow | `PENDING_DEPLOYMENT` |
| 실제 시장 가설 | `COLLECTING_NOT_STARTED` |
| Closed Alpha Stage 1 출시 | `STAGE1_NOT_READY` |

코드는 50명/최대 6주 실험을 안전하게 측정할 수 있는 단계까지 왔다. 그러나
도메인, 수급 bucket의 합법적·동의 기반 정의, exact-head Preview/Production,
Production migration 승인, v4 운영 attestation이 닫히지 않았다. 따라서 이
문서는 출시 승인이 아니라 `READY_FOR_EXTERNAL_REVIEW` 인수인계다.

Production DB migration, seed, 쓰기, Vercel Production 배포/alias 변경, 도메인
구매, Neon 유료 전환, Stage 2 확대, 사용자 결제 구현은 수행하지 않았다.

## 1. 수립한 과제

실행 계획은
[`FOUNDER_DECISION_EXECUTION_PLAN_20260812.md`](./FOUNDER_DECISION_EXECUTION_PLAN_20260812.md),
운영 source of truth는
[`CLOSED_ALPHA_STAGE1_RUNBOOK.md`](./CLOSED_ALPHA_STAGE1_RUNBOOK.md)다.

기준 문서 우선순위는 MVP Master Spec v4.2 → AI Agent Harness & Online
Marketing Playbook v0.1 → Alpha/Beta Target & Staged Reveal Change Note v0.1
→ Founder Decision Proposal v0.1 → v4.1 역사 문맥으로 고정했다. 제공된 labeling
dataset은 변경하지 않았고, 관찰한 SHA-256은
`b63f77dc7fa10694e4af6d3fc5ee86c4fcb4b01bda0889a1e96bcba4b1a55e51`다.

작업 패키지는 다음 다섯 개였다.

1. Stage 1 정책과 원자적 입장: 50석, 42일, 5 cohort, 유입 채널,
   privacy-minimized 수급 bucket, seat 51 DB 거부.
2. 실제 행동 영속화: 메시지, 고유 질문 노출 관계, UTC 접속일, waitlist
   재방문/삭제.
3. KPI와 판정: 명시적 분모·성숙도·threshold, 작은 표본 fail-closed,
   Go/Conditional/Collecting/No-Go 이유.
4. Founder/infra gate: domain 네 갈래 감사, Neon upgrade trigger, v4 Free
   예외, 결제 금지.
5. 개인정보·운영·인수인계: 최소수집, 삭제 잔존, disposable Neon,
   exact-SHA GitHub/Vercel/Production 절차.

## 2. 구현 결과

### 입장·모집

- `lib/alpha/stage1-policy.ts`가 50석, 최대 42일, 5 cohort, 선언형 채널,
  opaque `bucket_a` / `bucket_b` / `not_counted`를 고정한다.
- `lib/alpha/invite-admin.ts`와 PostgreSQL
  `alpha_stage1_capacity_guard`가 같은 transaction advisory lock을 사용한다.
  만료되지 않은 pending/reserved와 consumed를 세고 seat 51을 SQLSTATE
  `23514`로 거부한다.
- CLI는 `--cohort`, `--channel`, `--balance-bucket`을 필수로 받고 consumed
  초대를 revoke하지 않는다.
- 마이그레이션 이전 초대 12개는 `legacy_pre_stage1`로 분류한다. 기존 기술
  계정 접근은 유지하되 새 초대로 예약/소비할 수 없고 50석/KPI 모집단에서
  제외된다. 실제 Stage 1 참여자는 새 메타데이터로 재발급해야 한다.

### 행동·안전·개인정보

- `GET/POST /api/messages/[profileId]`는 실제 DB 메시지를 사용한다.
  인증·온보딩·실제 상대·unlock 관계·양방향 block 부재·1–500자·20/10분
  제한을 요구한다.
- block 생성과 message send는 동일한 unordered user-pair advisory lock을
  잡아 “권한 확인 직후 차단” 경합을 직렬화한다.
- 대화 조회는 최신 200개를 가져와 시간순으로 렌더링한다. HTTP 응답은
  private/no-store다.
- 활동은 사용자/UTC 날짜만, 노출은 고유 viewer/target 관계만, waitlist
  재방문은 entry/UTC 날짜만 보관한다. 반복 횟수와 정확 접속/노출/재방문
  시각은 저장하지 않는다.
- waitlist는 명시적 이메일 처리 동의, HMAC-pseudonymized IP rate limit,
  HMAC-hashed 256-bit 삭제 capability, generic duplicate 응답, same-browser
  삭제를 사용한다. 공개 폼의 acquisition은 사용자가 위조할 수 없게
  `organic`으로 고정했다.
- 계정 삭제는 message/activity/exposure와 message-target report 잔존을
  제거한다. 등록 실패 보상에서는 transaction-local flag로 reserved invite만
  보존하며 정상 탈퇴는 invite/email 연결을 삭제한다.
- `/privacy`와 설정 삭제 설명을 실제 수집·삭제 범위로 갱신했다.

### 측정·Founder gate

- `npm run alpha:metrics`는 content-free aggregate와 digest를 출력한다.
  모든 metric은 numerator, denominator, value, threshold, minimum sample,
  status를 가진다.
- 온보딩 ≥75%, 첫 blur median ≤180초, 질문 응답 ≥55%, 첫 메시지 평균
  ≥25자, 전체 D7 ≥40%, 채널 D7 ≥45%, waitlist 재방문 ≥25%, 60:40 유지
  ≥80%를 구현했다.
- 기본 metric 최소 표본은 10, channel/cohort는 5다. 부족한 표본은 0이나
  PASS가 아니라 `INSUFFICIENT_DATA`다.
- 지정된 다섯 cohort만 cohort No-Go 성숙도에 들어간다.
  `legacy_unassigned`가 다섯 cohort를 가장하거나 quality cohort가 될 수 없다.
- Go는 제품 하한 4개 중 3개 + 한 채널 D7 PASS + waitlist 재방문 PASS가
  모두 필요하다. 두 개 core stop signal 또는 성숙한 다섯 cohort 모두 실패가
  vanity metric보다 먼저 No-Go를 만든다.
- attestation v4는 exact 50, domain acquisition/clearance/handle/spelling,
  measurement/supply/monetization attestations, 최신 Capacity/Reliability/
  Operations/Data Risk trigger를 요구한다. Free에서 trigger 하나라도 true면
  safety gate가 실패한다.
- 결제/구독 dependency와 endpoint 부재를 테스트로 고정했다.

## 3. 변증법적 검증의 검증

단순 PASS를 받아들이지 않고 반대 명제를 먼저 시도했다.

| 주장 | 반증 시도/발견 | 수정·최종 증거 |
|---|---|---|
| 등록 실패 후 초대를 다시 쓸 수 있다 | 첫 disposable run에서 user 삭제 trigger가 reserved invite까지 지워 retry가 깨졌다. | transaction-local compensation flag; 이후 consume/finalize/profile 세 rollback PASS |
| 50석을 넘지 않는다 | 두 writer가 49석에서 동시에 insert했다. | 한 건만 성공, 한 건 SQLSTATE `23514`, 최종 50 |
| 기존 기술 데이터가 시장 KPI를 오염하지 않는다 | 기존 행에 `alpha_stage_1` default가 붙어 5개 기술 계정/12개 초대가 분모에 들어갈 수 있었다. | migration-time `legacy_pre_stage1`, 이후 default만 Stage 1; 기존 12개 격리와 legacy 예약 거부 실DB PASS |
| No-Go는 다섯 target cohort만 본다 | `legacy_unassigned` 행이 maturity/quality에 들어갈 수 있었다. | exact target allowlist + spoof regression test |
| 차단 후 메시지는 저장되지 않는다 | block 확인과 insert 사이 TOCTOU 경합이 있었다. | block/send 동일 pair transaction lock + 실DB 권한/삭제 PASS |
| 최소 데이터만 수집한다 | D7/응답률에 필요 없는 exact timestamp와 repeat count가 있었다. | 해당 column 제거; 격리 DB에서 불필요 column count 모두 0 |
| 채널 데이터는 관찰값이다 | 공개 waitlist body가 임의 channel을 주장할 수 있었다. | public source는 `organic` 고정; 위조 채널 거부 테스트 |
| domain gate는 canonical release를 묶는다 | 임의 domain 증거와 다른 host의 `/privacy`도 통과할 수 있었다. | acquired canonical domain = Production hostname = privacy hostname 요구 |
| 작은 표본은 Go가 아니다 | 1/1 완벽 표본을 투입했다. | `INSUFFICIENT_DATA`; Go 불가 |
| Free는 출시 자체로 안전/불안이 결정되지 않는다 | trigger true와 stale observation을 넣었다. | 최신 네 trigger가 모두 false일 때만 v2 exception 가능 |
| 테스트가 Production을 건드리지 않는다 | 각 disposable run 뒤 parent 원장/테이블/사용자/프로필/초대를 재조회했다. | parent `5 / 17 / 5 / 5 / 12` 불변, Production write 0 |

최신 격리 증거는
[`evidence/NEON_STAGE1_DISPOSABLE_VERIFICATION_20260812.json`](./evidence/NEON_STAGE1_DISPOSABLE_VERIFICATION_20260812.json)에
있다. 최신 검증 브랜치는 `br-winter-haze-aj639yoy`이고, 현재 소스의
마이그레이션 해시는 다음이다.

- `0005`: `0f0575bae676144d2b70b27f74e3f04b8c8d0faa4a708dc93e6494670183f608`
- `0006`: `d2d1054723b2674651206d89939c952162c02ed2e00b636fddbed8a73320667a`

구버전 disposable 브랜치 `br-floral-math-ajlshsfe`와
`br-lively-bar-ajgvk01n`은 진단 기록 후 삭제했다. 최신 브랜치는 committed
exact-SHA machine artifact 재실행을 위해 임시 보존한다. 소유 불명 기존
`br-holy-sunset-ajo5h07n`은 건드리지 않았다.

## 4. 현재 검증 표

| 검증 | 결과 |
|---|---|
| `git diff --check` | PASS |
| ESLint (`--max-warnings=0`) | PASS |
| TypeScript `--noEmit` | PASS |
| unit/static | 252/252 PASS |
| `drizzle-kit check` | PASS |
| Next.js production build | PASS; 새 message/waitlist routes 포함 |
| boundary / legacy guards | PASS / PASS |
| npm production/tooling audit | 0 / 0 vulnerabilities |
| disposable Neon | 17/17 tests, 27/27 required cases PASS |
| migration second run | no-op PASS |
| child schema | 7 hashes, 22 public tables, capacity trigger/function 각 1 |
| Production parent | read-only counts 불변; write/migration/seed 0 |
| exact committed SHA artifact | 아직 PENDING |
| deployed Preview 37-case smoke/browser | 아직 PENDING |

진단 Neon PASS는 committed SHA에 결박된 기계 artifact가 아니므로 launch
authority가 아니다. 게시 후 같은 HEAD로 artifact를 다시 만들고, GitHub CI와
Vercel Preview metadata가 같은 SHA인지 확인해야 한다.

## 5. Domain / Neon / Monetization 결정 상태

도메인 상세는
[`DOMAIN_AUDIT_20260812.md`](./DOMAIN_AUDIT_20260812.md)에 있다.
2026-08-12 연결된 Vercel 조회에서 `unstandard.com`은 unavailable,
`unstandard.app`은 당시 USD 9.99/1년으로 available이었다. `.kr`/`.co.kr`은
그 도구 결과에 없었다. 어떤 도메인도 구매·연결하지 않았다. 상표 class/
jurisdiction, exact handle matrix, 발음·철자 사용자 검사가 없으므로 판정은
`BLOCKED_FOUNDER_CHOICE_AND_CLEARANCE`다.

Neon Production은 Free, `protected=false`, recovery history 6시간이다. 이는
가격이 아니라 Operations/Data Risk 검토 사유다. founder가 현재 user-data
위험을 수용하고 v2 예외를 완성하거나 필요한 보호/복구 기능의 plan으로
전환하기 전 `productionDatabaseSafetyControlsApproved=true`를 쓰면 안 된다.

Closed Alpha의 monetization mode는 `disabled`다. fake-door도 이번 변경에
넣지 않았다. retention 이후 별도 WTP 결정 전에는 결제 구현을 시작하지 않는다.

## 6. 남은 차단 사항과 인수 순서

1. GitHub draft PR에서 exact head, diff, CI를 검토한다. merge하지 않는다.
2. 같은 SHA의 Vercel Preview를 Preview DB에 연결하고 `0005/0006`을
   비Production 절차로 적용한다. build가 migration을 자동 실행하면 안 된다.
3. 37-case HTTP smoke와 브라우저 랜딩→waitlist→삭제, 인증→온보딩→노출→
   unlock→message→상대 조회→report/deletion 흐름을 실행한다.
4. founder가 domain 후보, 상표/handle/spelling 결과, 구매를 별도로 승인한다.
5. founder가 하나의 comparable matching market에서 A/B 의미·동의 절차를
   승인하거나 `not_counted` 유지와 launch block을 명시한다.
6. support/moderation/privacy/deletion/restore/rollback owner와 opaque drill
   reference를 완성한다.
7. Production migration을 명시적으로 승인한 뒤에만 parent count/ledger를
   다시 읽고 `0005/0006`만 적용한다. seed 금지. 전후 사용자/프로필 수와
   7개 exact hash를 검증한다.
8. exact Production deploy/readiness와 operator-local attestation v4가 모두
   PASS한 뒤 작은 invite batch로 시작한다. 50명을 한 번에 채우지 않는다.

## 7. 알려진 한계

- 메시지는 Alpha의 첫 상호작용 측정 경로다. inbox 목록, 알림, 전달/read
  receipt, attachment는 없다.
- block repository와 DB 권한은 있지만 public block HTTP/UI는 아직 없다.
  Alpha 초대 전 기존 운영 차단 경로를 실제 사용자 관점에서 검증해야 한다.
- waitlist capability를 잃은 사용자를 위한 verified-email 수동 삭제 절차는
  운영자가 만들고 drill reference를 남겨야 한다.
- supply bucket은 의도적으로 의미를 모르는 label이다. 코드가 성별/성적
  지향을 추론하거나 수집하지 않는다.
- Fast-track mean depth와 Production AI depth는 `NOT_IMPLEMENTED`다.
- local mock message/profile 데이터는 개발 편의일 뿐 KPI 증거가 아니다.

## 8. Rollback / 정리

- merge 또는 Production 작업 전에는 원격 branch/Preview를 닫는 것만으로
  되돌릴 수 있다.
- Production migration 후에는 오래된 code로 단순 rollback하지 않는다.
  `0005/0006`을 이해하는 forward-compatible 배포를 검토한다.
- 데이터 사고 시 parent restore 전에 isolated historical branch로 조사한다.
  full restore는 별도 승인 없이는 금지한다.
- `br-winter-haze-aj639yoy`는 exact-SHA artifact를 확보한 뒤 증거를 보존하고
  정확한 ID로 삭제한다. `br-holy-sunset-ajo5h07n`은 소유/용도 확인 전 삭제
  금지다.

## 9. 게시 표면

- Local branch: `agent/founder-resolution-alpha-stage1-20260812`
- Baseline `main`: `da90853d28eaa77e71019f28f8f7e00cc3be7be4`
- Draft PR: <https://github.com/seonghyeonist/unstandard/pull/75>
- Published implementation commit: `399677d821157a13d596f7d15c5e6e8d9981320d`
- Published implementation tree: `3ae1442d7be38a415e33157abd0ea7bb8ad1cae0`
- Vercel Preview: `PENDING_DEPLOYMENT`
- Vercel Production baseline: `dpl_HaswwnRTj85dUp4sRaLiZFrycJza` (historical
  baseline SHA; this Stage 1 implementation 아님)

최종 원칙은 변하지 않는다. 코드의 PASS는 실험을 시작할 수 있는 조건일 뿐,
제품의 PASS가 아니다. 50명 행동 데이터가 나오기 전 Go를 선언하지 않는다.
