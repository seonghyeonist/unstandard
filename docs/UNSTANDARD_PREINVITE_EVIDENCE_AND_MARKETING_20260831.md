# Unstandard 초대 전 Production 증거·운영 게이트·마케팅 실행안

작성일: 2026-08-31  
상태: **초대 보류 (`STAGE1_NOT_READY`)**  
대상: Closed Alpha Stage 1 / 최대 50명 / 한국 성인 / 웹앱

이 문서는 기존 인수인계 문서의 후속 실행 기록이다. 이 문서 자체는 Production을 켜거나 초대를 발송하지 않는다. 실제 초대 전에는 반드시 **최종 릴리스의 동일 SHA**로 Production 증거와 운영 게이트를 다시 만든다.

## 1. 결론

현재 초대를 발송하지 않는다.

- 현재 `main` SHA는 `0c02fc3224eeec2fcc1cd9f622a44911e51282a5`다.
- 현재 Vercel Production 배포도 이 SHA의 `READY` 배포다: `dpl_qYabi7oGpqMDDg9ayVAyBgiasgZY`.
- 프로필·실명/휴대전화 인증 변경 PR #80의 현재 HEAD는 `c385717f2c4a8b63a1602c3ff5c0d83d999dc11c`이며 아직 draft/open/unmerged다.
- 따라서 현재 Production은 PR #80과 **동일 SHA가 아니다**. PR #80의 새 기능을 기준으로 초대 게이트를 닫을 수 없다.
- Vercel Production에 `UNSTANDARD_DEBUG_CHECK_TOKEN`은 존재하는 것으로 확인했지만, 토큰을 채팅이나 문서에 노출하지 않고 operator-local 명령으로 endpoint를 호출하는 단계가 아직 남아 있다.
- PR #80의 두 migration은 격리 Neon branch에서 스키마 rehearsal을 통과했지만, 이것은 표준 Node→Neon migrator 재실행/no-op와 Production 증거를 대체하지 않는다.

## 2. 2026-08-31 신선한 현재 상태

### 2.1 GitHub / Vercel

| 확인 항목 | 관찰 결과 | 의미 |
|---|---|---|
| GitHub `main` | `0c02fc32…` | 현재 Production이 기준으로 삼는 코드 |
| PR #80 HEAD | `c385717f…`, draft/open | 프로필·identity 변경은 아직 Production 대상이 아님 |
| PR #80 CI | `static-gates` 성공, `build (24.x)` 성공 | 정적/빌드 증거는 있음. Production 증거는 아님 |
| Production deployment | `dpl_qYabi7oGpqMDDg9ayVAyBgiasgZY`, `READY` | 현재 main SHA 배포가 살아 있음 |
| Production domain | `https://unstandard.app` 및 `www` alias 관찰 | canonical domain 운영 증거는 별도 attestation 필요 |
| Production runtime errors | 최근 7일 관찰상 없음 | 짧은 runtime 관찰. launch 승인 아님 |
| anonymous readiness request | `/api/operations/readiness`가 `404` | operator token 없는 요청을 숨기는 의도된 동작 |
| main 보호 | GitHub ruleset `Protect main` active, `static-gates`와 `build (24.x)` required | 병합 게이트는 존재. 실제 merge approval은 별도 판단 |

### 2.2 Production Neon root (읽기 전용 관찰)

- Project: `raspy-fog-00907976` (`unstandard-alpha-preview-app-db`)
- Root branch: `br-bitter-wave-ajs8dy0u`
- Region: `aws-us-east-2`
- Plan: `Free`
- Root branch `protected: false`
- History retention: 6시간으로 관찰됨
- 현재 ledger: `0000`–`0008`에 해당하는 9개 hash가 main의 현재 manifest와 일치
- `alpha.closed = {"enabled": true}`
- `unlock.active_question_id`가 기본 unlock question을 가리키며 해당 question은 active
- baseline aggregate: users `5`, profiles `5`, invites `12`, questions `2`, unlocks `0`, unlock attempts `0`
- 위 조회에서는 이메일·답변 원문·전화번호·실명·사용자 식별 원문을 선택하지 않았다.

Root에 migration/seed/write를 하지 않았다. Free + unprotected branch는 v4 attestation에서 신선한 Free-plan closed-alpha exception 또는 유료 protected branch 증거가 필요하다.

## 3. PR #80 Neon migration rehearsal

Production root의 자식으로 새 격리 branch를 만들고, branch ID를 고정하여 사용했다.

- Temporary branch: `br-autumn-frog-ajmmdyqb`
- Parent: `br-bitter-wave-ajs8dy0u`
- 목적: PR #80의 `0009_alpha_profile_identity.sql` 및 `0010_identity_notice_version.sql` 스키마 rehearsal
- 결과: ledger 11개, 서로 다른 hash 11개, latest id `11`
- `profile_basics`와 `identity_verifications` 신규 행: `0 / 0`
- `identity_verifications.notice_version`: `NOT NULL` 확인
- FK: user/profile/identity 관계와 `ON DELETE CASCADE` 확인
- CHECK: gender, age 19–120, 허용 지역, identity status/result/expiry 확인
- synthetic user → profile → verified identity 생성 후 user 삭제: 잔존 행 `users=0, profiles=0, identity=0`
- 잘못된 gender/age/region 입력은 각각 해당 CHECK constraint에서 거절됨

제한 사항:

1. 이 rehearsal은 직접 단일 SQL transaction으로 실행한 스키마 확인이다.
2. 표준 `scripts/db/migrate.ts`를 실제 Node runtime으로 실행한 증거가 아니다.
3. 두 번째 표준 migrator 실행의 machine-generated no-op artifact가 아니다.
4. PR #80의 exact Preview HTTP/browser smoke가 아니다.
5. Production migration approval이나 live PortOne/Danal 인증 증거가 아니다.

## 4. 초대 전 증거 생성 절차

### 4.1 현재 main의 신선한 Production 증거

이 명령은 **최종 승인된 코드의 로컬 clone**에서 실행한다. 현재 main 배포를 확인하려면 기대 SHA는 아래 값이다.

```bash
mkdir -p artifacts
export UNSTANDARD_PRODUCTION_BASE_URL=https://unstandard.app
export UNSTANDARD_EXPECTED_PRODUCTION_GIT_SHA=0c02fc3224eeec2fcc1cd9f622a44911e51282a5
export UNSTANDARD_PRODUCTION_READINESS_EVIDENCE_OUT=artifacts/production-readiness-0c02fc32-20260831.json
# UNSTANDARD_DEBUG_CHECK_TOKEN은 Vercel Production secret manager에서 로컬 프로세스에만 주입한다.
# 토큰 값은 채팅, GitHub, 문서, 스크린샷에 붙여 넣지 않는다.
npm run operations:production:verify
```

성공 조건:

- HTTP 200
- report `ok=true`
- report `vercelEnv=production`
- report `requestHost=unstandard.app`
- report SHA가 기대 SHA와 정확히 일치
- DB host fingerprint가 12자리 hex이고, 승인한 Neon target과 일치
- 10개 Production readiness gate가 정해진 순서로 모두 `PASS`
- evidence 파일이 새로 생성되고 `contentDigest`가 존재

`UNSTANDARD_DEBUG_CHECK_TOKEN`의 값은 이 문서에 기록하지 않는다. Vercel 환경변수 페이지에서 Production 항목의 존재만 확인하고, secret manager 또는 로컬 환경에 직접 주입한다. 값이 없거나 접근할 수 없으면 결과는 `BLOCKED_EXTERNAL`이며 추정 PASS를 만들지 않는다.

### 4.2 PR #80이 최종 승인된 뒤

PR #80의 최종 merge/promote SHA가 `c385717f…`와 달라질 수 있으므로, merge 이후 실제 GitHub commit SHA와 실제 Vercel `READY` deployment metadata를 다시 읽는다. 그 **최종 SHA**를 `UNSTANDARD_EXPECTED_PRODUCTION_GIT_SHA`에 넣어 위 명령을 다시 실행한다.

이전 main evidence, 이전 Preview evidence, 2026-08-28 handoff evidence, 이전 30-seat/v2 attestation은 새 SHA의 증거로 재사용하지 않는다.

### 4.3 v4 운영 attestation

Production evidence가 PASS한 뒤에도 다음 13개 attestation을 각각 실제 opaque reference와 함께 확인한다.

```text
incidentOwnerAssigned
supportChannelReady
rollbackProcedureReviewed
restoreDrillCompleted
privacyNoticePublished
accountDeletionProcedureVerified
moderationOwnerAssigned
rateLimitPolicyApproved
productionDatabaseSafetyControlsApproved
experimentMeasurementReady
supplyBalanceProcedureApproved
domainAcquired
monetizationDisabled
```

PR #80의 현재 rate-limit policy constant는 `closed-alpha-v3`다. 예제 JSON의 오래된 `closed-alpha-v2` 값을 그대로 사용하면 gate가 실패한다. 단, Neon Free 예외의 policy id `neon-free-closed-alpha-v2`와 앱 rate-limit policy `closed-alpha-v3`는 서로 다른 항목이다.

Free root branch를 계속 사용하려면 attestation에 다음이 필요하다.

- 정확한 Neon project/branch ID
- `plan=Free`, `protected=false`, `safetyMode=free_plan_closed_alpha_exception_v2`
- exception 만료가 승인 시각부터 30일 이내이고 현재 시각 이후
- capacity/reliability/operations/dataRisk 네 trigger가 모두 신선하게 false
- Production `reset/delete/DROP TABLE/TRUNCATE` 금지
- 모든 Production change에 수동 승인
- quota 또는 recovery degradation 시 초대 일시정지
- disposable migration drill과 restore drill reference

## 5. 실제 초대 순서

```text
최종 commit 고정
  → 새 Neon disposable branch에서 표준 migration + Node→Neon integration
  → 두 번째 migrator no-op 확인
  → exact-SHA Vercel Preview + HTTP/browser smoke
  → Production migration 명시 승인
  → Production DB baseline과 migration 적용
  → exact-SHA Production READY 확인
  → operations:production:verify PASS
  → v4 operational attestation 작성
  → operations:closed-alpha:gate PASS
  → 5명 이하 작은 batch 초대
  → 가입/온보딩/답변/신고/에러/성비·supply 확인 후 다음 batch
```

어느 한 단계라도 빠지면 초대를 보내지 않는다. `closed-alpha-gate` PASS 전에는 invite create command도 실행하지 않는다.

## 6. 형이 접속할 링크

### 필수 운영 링크

| 목적 | 링크 |
|---|---|
| GitHub repo | https://github.com/seonghyeonist/unstandard |
| PR #80 | https://github.com/seonghyeonist/unstandard/pull/80 |
| main ruleset | https://github.com/seonghyeonist/unstandard/rules/21377107 |
| Vercel project | https://vercel.com/unstandard/unstandard-m9qj |
| 현재 Production deployment inspector | https://vercel.com/unstandard/unstandard-m9qj/qYabi7oGpqMDDg9ayVAyBgiasgZY |
| Vercel Environment Variables | https://vercel.com/unstandard/unstandard-m9qj/settings/environment-variables |
| Neon project | https://console.neon.tech/app/projects/raspy-fog-00907976 |
| Neon rehearsal branch | https://console.neon.tech/app/projects/raspy-fog-00907976/branches/br-autumn-frog-ajmmdyqb |
| Production site | https://unstandard.app/ |
| Privacy page | https://unstandard.app/privacy |
| Operator readiness endpoint | https://unstandard.app/api/operations/readiness |

### 본인인증 계약·기술 확인 링크

- [PortOne V2 본인인증 흐름](https://developers.portone.io/opi/ko/extra/identity-verification/readme-v2?v=v2)
- [PortOne 다날 본인인증](https://developers.portone.io/opi/ko/integration/pg/v2/danal-identity-verification?v=v2)
- [PortOne SDK 요청 형식](https://developers.portone.io/sdk/ko/v2-sdk/identity-verification-request?v=v2)
- [PortOne REST API](https://developers.portone.io/api/rest-v2/identityVerification)
- [PortOne 계약/도움말](https://help.portone.io/category/service/identity-verification)

실제 활성화 전에는 계약·비용·발송 한도·번호별 abuse 방지·보유/이전 고지·로그 scrub을 먼저 승인한다. `PORTONE_API_SECRET`을 채팅이나 GitHub에 입력하지 않는다.

## 7. Closed Alpha 마케팅 전략

### 7.1 목표와 제한

목표는 대중 노출이 아니라 50명을 관찰 가능한 cohort로 선별하는 것이다. 후보 풀은 70–100명 정도로 만들고, 실제 초대는 운영 gate PASS 후 작은 batch로 진행한다. Paid ads는 사용하지 않는다. 현재 제품 Alpha는 광고·결제·구독을 열지 않는다.

알파의 모집 채널은 대학생 접근성을 활용할 수 있지만, 제품을 대학생 전용으로 말하지 않는다. Beta부터는 25–39세를 중심 타깃으로 전환하고, 제품 원칙은 `선 정성 후 정량`으로 유지한다.

### 7.2 플랫폼 우선순위

| 우선순위 | 플랫폼 | 역할 | 권장 cadence | CTA |
|---:|---|---|---|---|
| 1 | Threads | 질문·문장·댓글 대화로 초기 관심과 waitlist 유입 | 원글 4–5회/주, 댓글 대화 매일 | `unstandard.app` |
| 2 | Instagram Reels/Stories | 브랜드 감정과 제품 흐름을 짧은 영상으로 증명 | Reels 2회/주, Stories 3회/주 | 프로필 링크 → `unstandard.app` |
| 3 | YouTube Shorts | Reels 원본을 검색·재방문 가능한 자산으로 재활용 | 1회/주 | 설명란/고정 댓글 → landing |
| 4 | TikTok | 짧은 3주 유기적 실험. 초기 주력 채널은 아님 | 1회/주 테스트 | landing, 과장 없는 CTA |
| 5 | X / Naver Blog·Brunch | 빌딩 인 퍼블릭과 긴 맥락 보관 | 1회/주 | waitlist 또는 기술 문서 |
| 6 | Discord / Kakao 오픈채팅 | 초대 후 운영·피드백 공간 | 초대 후 개설 | support channel |

Threads를 첫 채널로 두는 이유는 Unstandard의 핵심이 이미지보다 질문과 답변이고, 원문 대화가 바로 콘텐츠가 되기 때문이다. Instagram과 Shorts는 같은 9:16 master를 재사용하되, 각 플랫폼의 native caption/audio와 CTA를 별도로 손본다.

### 7.3 콘텐츠 기둥과 실제 문구

#### A. 문제 공감

> 소개팅 앱에서 제일 지치는 건 매칭이 아니라, 매칭 뒤에 아무 말도 남지 않는 순간일 때가 있어요.

> “안녕하세요”를 잘하는 사람을 찾는 게 아니라, 한 문장에 자기 세계가 묻어나는 사람을 만나보고 싶었습니다.

#### B. 질문 카드

> 질문 하나만.
> 평생 한 가지 배달 음식만 먹어야 한다면 뭘 고를 건가요?
> 이유까지 말해주면 더 궁금해질 것 같아요.

> 나만 좋아하는 이상한 조합이 있나요?
> Unstandard는 그런 사소한 고집에서 첫 대화를 시작해보려 합니다.

#### C. 철학은 짧게

> “외모보다 내면”이라는 말은 너무 쉽게 할 수 있습니다.
> 그래서 우리는 거창한 검사가 아니라 질문 하나부터 바꿔봅니다.

#### D. Building in public

> 오늘은 답변 품질 mock을 붙였습니다.
> 아직 AI라고 부르지 않아요. 지금은 첫 질문에 답하는 흐름이 실제로 재미있는지부터 확인하는 중입니다.

#### E. Closed Alpha 모집

> 첫 대화가 “안녕하세요”로 시작하지 않는 소개 웹앱을 만들고 있습니다.
> 사진보다 질문 하나에 먼저 답하고, 그 답변으로 상대의 세계를 조금 열어보는 방식입니다.
> 50명만 먼저 받는 Closed Alpha입니다. 많이 모으기보다 제대로 관찰할 사람을 찾습니다.

#### F. 안전·운영 고지

> 이건 공개 매칭 서비스가 아니라 작은 Closed Alpha입니다.
> 가입 전 안내를 읽고, 불편한 사용자는 신고·차단·삭제 요청을 할 수 있어야 합니다.
> 실제 인증 기능과 공개 범위는 운영 gate가 열린 뒤에만 안내합니다.

현 live identity가 아직 차단된 상태에서는 “본인인증 완료”, “안전이 검증된 매칭”, “AI가 잘 맞는 사람을 골라준다” 같은 문구를 사용하지 않는다.

### 7.4 15–25초 영상 3종

#### Video 1 — `안녕하세요` 문제

| 시간 | 화면/자막 | 음성 |
|---:|---|---|
| 0–2초 | 큰 자막: `왜 첫 대화는 늘 비슷할까?` | “왜 첫 대화는 늘 비슷할까요?” |
| 2–6초 | 빈 채팅 말풍선 3개가 빠르게 나타남 | “매칭은 됐는데, 남는 말이 없을 때가 있습니다.” |
| 6–12초 | 질문 카드: `최근 마음이 느슨해졌던 순간은?` | “우리는 질문 하나에서 시작해보려 합니다.” |
| 12–18초 | 단색 UI mock → 일부 blur가 열리는 모션 | “사진보다 먼저, 한 사람의 문장.” |
| 18–22초 | 로고 + `Closed Alpha / 50명` | “작게 테스트할 사람을 기다립니다.” |

#### Video 2 — 질문 하나의 힘

| 시간 | 화면/자막 | 음성 |
|---:|---|---|
| 0–3초 | `사진을 보기 전에 질문 하나` | “사진을 보기 전에 질문 하나만 먼저.” |
| 3–8초 | 한 문장 답변이 타이핑되는 추상 화면 | “짧아도 괜찮아요. 장면 하나만 구체적으로.” |
| 8–14초 | 답변 카드 일부와 `조금 열림` 상태 | “답이 어울리면 가려진 세계가 조금 열립니다.” |
| 14–20초 | `unstandard.app` + `질문으로 시작하는 소개` | “Unstandard Closed Alpha.” |

#### Video 3 — 솔직한 building in public

| 시간 | 화면/자막 | 음성 |
|---:|---|---|
| 0–4초 | 창업자 손/노트북 또는 코드 diff. 실제 개인정보 없음 | “거창한 AI 데이팅앱을 만들고 있는 건 아닙니다.” |
| 4–10초 | `현재: mock / 다음: 실제 사용자 흐름 검증` | “지금은 질문에 답하고, 블러를 열고, 대화하는 기본 흐름부터 봅니다.” |
| 10–16초 | 랜딩의 질문·blur 시각 언어 | “좋은 첫 대화가 실제 행동으로 이어지는지 확인하려고요.” |
| 16–22초 | `50명 Closed Alpha` + waitlist URL | “작게 써보고 솔직하게 말해줄 50명을 찾습니다.” |

영상 공통 규칙:

- master는 1080×1920, 9:16, 15–25초로 만든다.
- 첫 2초 안에 문제 또는 질문을 보여준다.
- 한 화면에 핵심 자막 하나만 둔다. 자막은 2줄 이내로 유지한다.
- 실제 사용자 답변·프로필·전화번호·이메일·identity 화면을 영상에 넣지 않는다.
- 제품이 하지 않는 것을 약속하지 않는다. mock은 mock이라고 말한다.
- 최종 업로드 직전에 각 플랫폼 native caption/audio와 safe zone을 확인한다.

### 7.5 디자인 시스템

현재 landing의 시각 언어를 그대로 확장한다.

| 역할 | 값 |
|---|---|
| background | `#f7f3ed` |
| foreground | `#202433` |
| accent | `#c54434` |
| line | `#d7d0c8` |
| success | `#2e7d5b` |
| font | Inter + 한국어 system sans fallback |
| tone | 조용함, 관찰, 구체적인 장면, 과장 없는 초대 |

디자인은 광고처럼 반짝이기보다 질문 카드·빈 여백·짧은 문장을 중심으로 만든다. 빨간 accent는 질문 밑줄, CTA, `closed alpha` label에만 사용한다. 화면을 꽉 채운 커플 사진, 외모 전후 비교, “운명”, “정확도”, “검증된 상대” 같은 표현은 사용하지 않는다.

Adobe Express에서는 위 색·폰트·로고·CTA를 Brand Kit으로 저장하고, 하나의 master design에서 Reels/Stories/Shorts 사이즈를 파생한다. Higgsfield를 쓸 때는 제품의 추상적인 분위기·손·노트·질문 카드 같은 B-roll만 만들고, 실제 사용자나 매칭 결과처럼 보이는 합성 인물을 만들지 않는다. 생성 영상에는 AI 생성 여부를 내부 asset log에 기록한다.

### 7.6 6주 실행 캘린더

| 주차 | 운영/제품 | 마케팅 |
|---:|---|---|
| 0 | exact SHA, disposable DB, Preview, Production evidence gate | 프로필 정리, 3개 영상 master, waitlist는 유지. 초대는 보류 |
| 1 | landing·waitlist·onboarding smoke | Threads 질문 3개 + Reels 1개. 어떤 질문이 저장/댓글을 만드는지 확인 |
| 2 | answer flow·mock quality 확인 | 문제 공감 2개 + 질문 카드 2개 + Shorts 1개 |
| 3 | auth/profile/identity 계약 gate | cohort별 모집 문구를 분리하되 대학생 전용처럼 보이지 않게 함 |
| 4 | unlock/message/report smoke | 운영 gate PASS 후에만 5명 이하 첫 batch. 질문·버그 피드백 수집 |
| 5 | 배포·보안·복구 확인 | 첫 cohort의 동의된 익명 관찰 결과만 콘텐츠화 |
| 6 | metrics·D7·supply 회고 | 회고 콘텐츠. 다음 batch 또는 redesign 결정 |

### 7.7 KPI와 중단 규칙

기존 Stage 1 계약의 초기 기준을 사용하되, 숫자가 곧 launch 승인은 아니다.

| 지표 | 목표/관찰 기준 | 미달 시 |
|---|---|---|
| 후보 신청자 | 70–100명 | 카피·채널 수정 |
| 실제 초대 계정 | 최대 50명 | 운영 gate와 supply를 확인하며 batch 조절 |
| 온보딩 완료율 | `>=70%` | 질문 수·첫 화면 마찰 축소 |
| 첫 질문 답변율 | `>=55%` | 질문 난이도와 helper 문구 수정 |
| 첫 blur 해제 | 중간값 `<=3분` | 단계·카피·empty state 점검 |
| D7 retention | `>=25%`, 이상적으로 40% 근접 | 질문 재방문 이유와 알림 설계 재검토 |
| 피드백 제출 | `>=30%` | 폼 간소화 |
| 신고/차단 | 급증 없음 | 즉시 초대 중단, moderation review |
| supply balance | founder-defined bucket 기준 안정 | minority boost/soft waitlist/hard gate |

채널별 성과는 조회수보다 `프로필 클릭 → landing → waitlist → onboarding → 첫 답변 → D7`로 본다. 한 번에 카피·썸네일·영상 길이를 모두 바꾸지 않는다. 유입 channel은 앱이 실제로 허용하는 `acquisition_channel` 값과 일치시킨다. 새 tracking을 급하게 추가하거나 waitlist에 불필요한 개인정보를 더 받지 않는다.

## 8. 사용할 툴과 역할

| 툴 | 지금 할 일 | 주의 |
|---|---|---|
| GitHub | PR #80의 exact HEAD·CI·ruleset 확인, 문서 PR review | merge는 Preview/Production evidence와 별도. secret commit 금지 |
| Vercel | READY deployment SHA, domain, Production env 변수 이름 확인 | secret 값은 로컬에만 주입. env 변경은 별도 승인 |
| Neon Postgres | root는 read-only baseline, 새 branch에서 migration/integration/recovery rehearsal | root에 임의 SQL·seed·reset·truncate 금지 |
| PortOne/Danal | 계약·요금·LIVE channel·개인정보 처리 조건 확인 | 계약 전 live identity enable 금지 |
| Higgsfield Marketing Studio | 추상 B-roll, 질문 카드 분위기, 영상 variation | fake user/fake result를 실제 증거처럼 만들지 않음 |
| Adobe Express | Brand Kit, 카드·Reels·Stories·Shorts resize | 같은 master에서 파생하고 safe zone 재확인 |
| Threads | 질문과 댓글 대화, 1차 organic acquisition | 복붙보다 원문 대화와 답변을 우선 |
| Instagram | Reels/Stories로 시각적 제품 감각 전달 | 9:16, audio/caption, 광고용 claims와 organic claims 분리 |
| YouTube Studio | Shorts 업로드·Analytics, evergreen archive | square/vertical, 최대 3분. 초기에는 15–25초 권장 |
| TikTok Creative Center | trend/top ads 관찰, 3주 organic test | paid ad로 50명 ceiling을 넘기지 않음 |

현재 연결된 `app-6a...` 도구는 완성형 faceless video, narrator, subtitle 작업을 위한 skill이다. 이번 요청은 전략·콘티 단계이므로 아직 완성 영상을 생성하지 않는다. 실제 영상 제작 시에는 영상 완성 요청에 맞춰 narrator/subtitles를 별도로 실행한다.

## 9. 공식 제작 참고

- [Meta: Introducing Threads](https://about.fb.com/news/2023/07/introducing-threads-new-app-text-sharing/) — Threads의 텍스트·링크·사진·영상 게시 맥락
- [Threads for Creators](https://creators.instagram.com/threads) — original content를 우선하는 공식 creator guidance
- [Instagram Reels](https://business.instagram.com/instagram-reels) — 9:16 vertical creative guidance
- [Instagram Reels size and aspect ratios](https://help.instagram.com/1038071743007909) — Reels 해상도·비율·cover 안내
- [YouTube Shorts 업로드](https://support.google.com/youtube/answer/12779649?co=GENIE.Platform%3DDesktop&hl=en) — square/vertical, 최대 3분
- [YouTube Shorts for Creators](https://www.youtube.com/creators/create/shorts/) — Shorts 발견 경로와 analytics
- [TikTok Creative Center](https://ads.tiktok.com/creative/creativeCenter) — trends/top ads/creative tools
- [TikTok Creative Center 도움말](https://ads.tiktok.com/resources/help/article/creative-center?lang=en) — login 없이도 Creative Center를 볼 수 있다는 공식 안내
- [Higgsfield Marketing Studio](https://higgsfield.ai/marketing-studio) — marketing video/storyboard/image workflow
- [Adobe Express](https://www.adobe.com/express/) — social campaign과 channel resize
- [Adobe Express Brand Kit](https://www.adobe.com/express/create/brand-kit) — 색·폰트·브랜드 자산 관리

## 10. 현재 남은 blocker

1. PR #80이 아직 Production과 동일 SHA가 아니다.
2. operator token을 사용한 새 `operations:production:verify` artifact가 없다.
3. PR #80 기준 exact Preview deployment와 HTTP/browser smoke가 없다.
4. 표준 Node→Neon integration, migrator second-run no-op, concurrency drill이 새 HEAD에서 없다.
5. PortOne/Danal 계약·비용·live channel·개인정보/로그 scrub 검토가 끝나지 않았다.
6. 현재 Neon root는 Free + unprotected라 fresh Free-plan exception 또는 protected paid branch evidence가 필요하다.
7. v4 attestation의 support, deletion, restore, moderation, supply, domain 네 부분 audit, monetization disabled evidence가 비어 있다.
8. 최종 SHA 기준 Production gate가 PASS하기 전에는 실제 초대·대량 invite·identity enable을 하지 않는다.

이 blocker 목록이 모두 닫히고, 동일 최종 SHA에 대해 Production evidence와 `operations:closed-alpha:gate`가 PASS한 뒤에만 5명 이하 첫 batch를 시작한다.
