# UNSTANDARD 기본 프로필·본인인증 잔여 작업 인수인계

작성일: 2026-08-28
중단 사유: 사용자 요청에 따라 잔여 구현을 다음 세션으로 이월. 이번 후속 작업은 인수인계 문서 추가만 수행한다.

## 1. 현재 판정

**코드 구현·합성 테스트 완료 / 실제 본인인증 비활성 / 출시 승인 아님**

- 저장소: `seonghyeonist/unstandard`
- [Draft PR #80](https://github.com/seonghyeonist/unstandard/pull/80): open, Draft, 미병합.
- 작업 브랜치: `feat/alpha-profile-identity-20260828`
- 문서 추가 직전 GitHub 코드 HEAD: `7d2a8a33a441193dec88a3534742312896745af6`
- 같은 코드의 로컬 HEAD: `f18a33b0c3153ba92136376bd1f755fb884196fc`
- 양쪽 코드 tree: `76c3945b8374613732db0785257f2843a8c93848`
- PR 기준 main: `0c02fc3224eeec2fcc1cd9f622a44911e51282a5`. 이는 PR 기준점이며, 다음 세션의 최신 Production SHA라고 가정하지 않는다.
- 이번 기능 작업에서 Production DB, main, Production 설정·배포를 변경하지 않았다. 운영 DB의 신규 신청자 수를 이번 문서 작성에서 다시 조회하지 않았다.

**로컬·원격 SHA 차이는 게시 경로에서 커밋 메타데이터가 달라진 결과다. 코드 tree는 같지만 히스토리는 다르다.** 다음 세션은 원격 최신 브랜치를 기준으로 시작하는 것이 안전하다. 기존 로컬 브랜치를 원격에 강제 push하지 않는다. 이 문서가 추가된 후 최신 HEAD는 위 코드 HEAD와 달라질 수 있으므로 문서만 추가된 diff인지 확인한다.

기존 dev가 운영 스키마보다 오래되어 이 기능은 main 기준으로 분리했고 PR도 main을 대상으로 한다. 이것이 병합 승인을 뜻하지 않는다.

## 2. 사용자 결정과 미확인 사항

### 확정

- 기본 프로필: 닉네임, 남녀 선택, 만 나이, 넓은 활동 지역, 이번 알파의 남녀 간 소개 범위 확인.
- 실명과 휴대전화 소유 **모두 인증**. SMS 번호 확인만이나 운영자 수동 확인으로 낮추지 않는다.
- 실명·전화번호는 일반 프로필과 분리하고 확인 후 원문을 별도 보관하지 않는 방향.
- 기존 회원의 새 정보는 추정하지 않으며, 본인 입력·인증·온보딩·소개 범위 확인 전에는 소개 기능을 제한.
- 지금은 작업을 멈추고 다음 세션에 이어간다.

### 미확인 — 사용자에게 다음에 확인할 것

1. PortOne 계정·다날 본인인증 계약이 이미 있는지, 신규 신청이 필요한지.
2. 계약에 필요한 사업자 상태와 해당 서비스 업종의 심사 가능 여부.
3. 실제 계약 요금·발송 한도·개인정보 처리조건, LIVE 인증 테스트 범위/예산.

PortOne V2/다날은 구현한 **연동 대상**이다. 사용자가 유료 계약을 체결했거나 그 계약·과금·개인정보 이전을 승인했다고 해석하지 않는다. 인증키는 채팅·문서·저장소 대신 해당 환경의 서버 전용 secret manager로 전달한다.

## 3. 완료한 구현

| 영역 | 구현된 내용 |
|---|---|
| 기본 프로필 | 가입 이후 `/profile-setup`, 수정·삭제·소개 철회. 나이는 입력 시점 만 19~120세 정수, 지역은 시도 단위 |
| 서버 입력 검증 | strict schema, 요청 크기 제한, 로그인 본인 권한, same-origin, private/no-store, DB 기반 요청 제한 |
| DB | `profile_basics`와 별도 `identity_verifications`; 원문 이름·번호·생년월일·CI/DI·OTP 컬럼 없음 |
| 기존 회원 | 자동 backfill 없음. 기본 정보 변경 시 revision 갱신·기존 인증 삭제. 철회 시 인증 결과 cascade 삭제 |
| 소개 접근 | 양측 기본 정보·인증·온보딩·동의·유효기간과 서로 다른 성별·차단 여부 확인. 후보·직접 프로필·unlock·메시지에 적용 |
| 인증 | PortOne SDK 입력 → 서버 UUID 요청 → canonical 결과 조회. LIVE/V2/다날/정확한 channel key·요청 ID·인증된 이름·시각 검사 |
| 복귀·재시도 | 모바일 callback 쿼리 전부 폐기. GET으로 인증 확정하지 않음. 본인 pending ID를 DB에서 복구해 결과 재확인 |
| 집계 | Stage 1 가입 확정 계정의 성별·인증·소개 가능 수. A/B 역할과 성별은 분리. 대기 명단 성별은 미수집 |
| 안내 | 기본 정보·인증 처리 설명, 미입력 제한, 철회·삭제 안내. 인증사 실제 보유기간 고지는 아직 확정 전 |

### 해석상 주의

- 성별·나이는 자기기입이며 본인인증으로 검증된 값으로 표시하지 않는다. 365일 후 재입력·재인증 조건이 있다.
- 남녀 간 소개 범위 동의는 성적 지향의 확인·인증이 아니다.
- CI/DI를 저장하지 않으므로 1인 1계정 중복 가입 차단을 제공하지 않는다.
- 다날의 전화번호 반환은 추가 계약 대상일 수 있다. 이 구현은 번호 문자열의 반환을 요구하지 않고, 지정한 LIVE 다날 휴대폰 본인인증의 성공을 근거로 삼는다.
- 인증사 화면에 직접 입력하더라도 canonical 응답의 이름·번호·CI/DI 등이 서버 메모리에 일시 들어올 수 있다. DB·앱 로그·클라이언트에 원문을 복사하지 않는 구조이지, 원문이 앱 서버를 전혀 거치지 않는 구조는 아니다.
- 메모리 즉시 보안 삭제, 외부 인증사·통신사 기록 즉시 파기, 플랫폼 로그 무잔존을 검증 완료했다고 말하지 않는다.

## 4. 검증 결과와 증거의 범위

| 확인 항목 | 결과와 한계 |
|---|---|
| 최신 코드 `npm run check` | 332 tests / 0 failed, lint, TypeScript, Next build PASS |
| repository guards | `guard:boundaries`, `guard:no-legacy-backend` PASS. 당시 tracked 414 / active 233 |
| 인증 adapter·SDK 흐름 | 합성 HTTP 응답과 SDK stub으로 위조·다른 채널·TEST·취소·오류·시간 초과·크기 제한·재시도·만료 검사. 실인증 아님 |
| 실제 server factory | 합성 설정을 완전히 주입해도 고지 gate가 false여서 null 반환 확인 |
| client 빌드 검사 | 27개 JS chunk에서 secret env 이름·canonical 서버 API URL 문자열 미검출. 운영 시크릿/로그 감사의 대체 아님 |
| 화면 | SSR 필드·비활성 상태·pending 결과 확인 버튼 검사 PASS. 실브라우저 E2E는 미완료 |
| 격리 Neon | 최초 단계에서 migration ledger 11건 일치, 실제 컴파일된 SQL 정책·제약·삭제 cascade 점검 PASS. 합성 fixture rollback, 신규 프로필/인증 잔존 0 |
| 미완료 | Node→Neon 전체 통합, 표준 migrator 재실행/no-op, 동시성 drill, live 본인인증, exact-SHA Preview smoke, 최신 Production 운영 gate |

**과거 증거와 최신 코드를 구분한다.**

- [최초 단계 evidence JSON](./evidence/profile-identity-20260828/verification.json)은 307 tests 및 최초 working tree의 증거다.
- 이 JSON의 `identityProviderAdapter: NOT_IMPLEMENTED_PROVIDER_NOT_SELECTED`는 당시 기록이며, 이후 adapter 코드와 사용자 결정이 추가됐다. 과거 증거를 현재 판정처럼 사용하거나 내용을 새 PASS로 덮어쓰지 않는다.
- 최신 332 tests와 adapter 상태는 [후속 연동 보고서](./PORTONE_IDENTITY_INTEGRATION_20260828.md)에 기록했다.
- 격리 SQL 검사를 HTTP/repository 전체 통합 검사나 현재 HEAD의 출시 증거로 승격하지 않는다.

## 5. 실제 인증을 막고 있는 조건

현재 `lib/identity/notice.ts`의 `IDENTITY_PROVIDER_NOTICE_READY=false`이고, factory가 null을 반환한다. 실제 인증키를 설정하거나 라이브 인증을 호출하지 않았다.

환경변수 이름만 `.env.example`에 추가했다:

- `UNSTANDARD_IDENTITY_ENABLED` — 기본 false
- `PORTONE_STORE_ID`
- `PORTONE_IDENTITY_CHANNEL_KEY`
- `PORTONE_API_SECRET` — 서버 전용, 공개 변수로 만들지 않음

고지 gate는 임의 환경변수로 우회하지 않는다. 실제 처리조건·비용/남용 대책을 검토·게시한 다음 코드 리뷰로 변경하고, 승인된 제한 범위에서 live 검증을 수행한다.

**이 상태에서 main에 병합·Production 배포하면 미인증 사용자의 소개 기능이 막힌다.** 과거 다른 알파 작업의 배포 승인이나 테스트 PASS만 근거로 이 변경을 운영에 적용하지 않는다.

## 6. 다음 세션 작업 순서

### A. 먼저 현황 재확인

1. 원격 PR #80의 최신 HEAD·Draft·미병합 상태와 작업 트리를 확인한다.
2. `AGENTS.md`, `CONTRIBUTING.md`와 아래 연결 문서를 읽는다.
3. 사용자에게 계정·계약 준비 상태만 우선 확인한다. 사용자가 정한 “실명과 휴대전화 모두 인증”을 다시 선택하게 하지 않는다.
4. 운영 환경은 필요할 때 읽기 전용으로 새로 식별한다. 과거 배포 SHA와 신청자 수를 현재 사실로 재사용하지 않는다.

### B. 외부 계약과 별개로 진행 가능한 검증

- 허용된 네트워크 환경에서 **새 disposable Neon branch**를 만들고 용도를 식별한다. 이전 임시 브랜치는 정리·삭제됐으며 연결값을 재사용할 수 없다.
- 기존 migration 0009/0010과 manifest를 유지한 채 표준 runner 적용·재실행/no-op 및 실제 Node repository/HTTP 통합을 검증한다.
- `0010_identity_notice_version.sql`은 NOT NULL 필드를 추가한다. 적용 대상에 인증 행이 이미 있으면 동의를 임의 backfill하지 말고 먼저 데이터 상태와 처리 계획을 검토한다.
- 프로필 수정/철회와 메시지·unlock 쓰기 경합, 계정 삭제·cascade, 과거 사용자 미입력 차단, 인증 실패 시 mock fallback 없는지 점검한다.
- 인증사 미연결 상태의 UI·지원·탈퇴 접근도 실제 브라우저에서 검증한다.
- 이전 Cloud Browser localhost는 `ERR_BLOCKED_BY_CLIENT`였고 직접 DB 네트워크 경로도 제한됐다. 제한을 우회하거나 성공을 추정하지 말고 허용된 실행 환경을 마련한다.

### C. 계약 준비 후 실제 인증 검증

- PortOne/다날 계약 자격·업종·요금과 LIVE 채널을 확인한다. 다날 SMS 본인인증은 계약과 실제 키가 있어야 연동 검증 가능하다는 공식 안내를 재확인한다.
- 개인정보 처리자·항목·기간·이전·문의 경로를 실제 계약과 맞추고 `/privacy` 및 동의 버전을 검토한다.
- 앱 시작 제한은 계정 3회/일 + 전체 100회/일, 결과 확인은 계정 10회/10분이다. **공개 store/channel 재사용 및 인증사 재전송에 대한 총 과금 차단은 아니다.**
- 제공사 차원의 비용·번호별·재전송·도메인 제한, 알림과 비상 중단 수단을 확인한다. 없으면 기능을 계속 닫거나 설계를 재검토한다.
- callback URL query, HTTP body, Authorization, 오류·tracing·session replay가 실제 플랫폼에 남지 않는지 점검한다.
- 승인된 테스트 참여자·예산·환경으로 PC popup, 모바일 복귀, 취소·만료·재시도·타인 요청·revision 변경을 검증한다. 테스트 명목으로 타인의 실명·전화번호를 사용하지 않는다.

### D. 배포 검토 — 위 단계 이후 별도

- Preview 전용 DB·환경변수와 배포 SHA를 맞추고 전체 사용자 흐름 증거를 만든다.
- 기존 회원 재입력 안내, migration/deploy 순서, 장애 시 소개 중단·복구 계획을 확정한다.
- Production 변경 범위를 명시하고 해당 승인을 확인한 뒤에만 적용한다.
- 최신 동일 SHA의 Production 증거·운영 gate를 재생성한다. 현재 rate-limit 정책은 `closed-alpha-v3`이며 예전 v2 attestation으로 대신할 수 없다.
- 소개 노출·인증·성별 집계가 맞는지 확인하기 전 50명 알파 초대 확대를 승인하지 않는다.

## 7. 핵심 파일과 이어읽기

| 목적 | 위치 |
|---|---|
| 전체 기능·migration 인수인계 | [ALPHA_PROFILE_IDENTITY_20260828.md](./ALPHA_PROFILE_IDENTITY_20260828.md) |
| 인증사 연동·개통 조건·공식 출처 | [PORTONE_IDENTITY_INTEGRATION_20260828.md](./PORTONE_IDENTITY_INTEGRATION_20260828.md) |
| 최초 SQL 검사 | [disposable-sql-checks.sql](./evidence/profile-identity-20260828/disposable-sql-checks.sql) |
| 기본 프로필 화면 | `components/profile/profile-basics-form.tsx`, `app/profile-setup/page.tsx` |
| 인증 계약·정책·adapter | `lib/identity/contracts.ts`, `service.ts`, `portone.ts`, `browser-flow.ts`, `notice.ts` |
| 서버 factory·API | `lib/server/identity/`, `app/api/identity/` |
| DB·접근 정책 | `lib/db/schema/profile-basics.ts`; `lib/db/repositories/`의 `profile-basics.repository.ts`, `identity.repository.ts`, `introduction-policy.ts` |
| 주요 테스트 | `tests/identity-verification.test.ts`, `tests/profile-basics.test.ts`, `tests/integration/` |
| 알파 운영 절차 | [CLOSED_ALPHA_STAGE1_RUNBOOK.md](./CLOSED_ALPHA_STAGE1_RUNBOOK.md) |

로컬 품질 검사:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run guard:boundaries
npm run guard:no-legacy-backend
git diff --check
```

DB migration·통합 테스트 명령은 대상 DB와 파괴적 테스트 승인 설정을 확인한 뒤 해당 런북에 따라 실행한다. Production URL을 테스트 변수에 복사하지 않는다.

## 8. 중단·복구 시 주의

`UNSTANDARD_IDENTITY_ENABLED=false`는 앱의 새 인증 시작/완료를 막지만, 공개된 채널을 사용하는 외부 호출과 이미 인증된 회원의 소개 접근을 모두 차단하는 스위치는 아니다. 과금 중단에는 제공사 채널 중지가 추가로 필요할 수 있다.

이전 코드는 성별·본인인증 접근 제한이 없으므로 단순 코드 rollback만 하면 제한이 사라질 수 있다. 운영에 적용한 이후에는 먼저 소개 접근을 닫고 영향 평가 후 복구한다. 현재 작업은 아직 운영 미적용이므로 현 운영 롤백은 필요하지 않다.

## 9. 다음 세션 시작 프롬프트

> GitHub seonghyeonist/unstandard의 Draft PR #80과 이 인수인계서를 기준으로 잔여 작업을 이어가줘. 먼저 원격 최신 HEAD와 검증 범위를 확인해. 실명과 본인 명의 휴대전화 소유를 모두 인증하는 결정은 확정됐고, PortOne V2/다날 adapter는 구현됐지만 실제 인증은 비활성이야. 계정·계약 준비 여부부터 확인하고, 계약 없이 가능한 격리 DB 전체 통합·동시성·브라우저 검증을 진행해. 실제 계약·고지·비용/남용 통제 확인 없이 gate를 풀거나 개인정보를 수집하지 마. 원문 신상을 저장하거나 임의 verified로 우회하지 말고, 실제 수행한 검증과 미완료 항목을 구분해 보고해. Production 변경은 적용 범위와 승인을 따로 확인해.
