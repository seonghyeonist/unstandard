# 기본 프로필·소개 범위·인증 경계 구현 인수인계

- 작성: 2026-08-28
- 기준 코드: `0c02fc3224eeec2fcc1cd9f622a44911e51282a5`
- 기능 브랜치: `feat/alpha-profile-identity-20260828`
- 판정: **IMPLEMENTED_WITH_BLOCKED_LIVE_IDENTITY / NOT_READY_FOR_PRODUCTION**
- 후속: 사용자가 실명과 휴대전화 소유 모두 인증하는 방식을 선택했다. PortOne V2/다날 연동 코드와 추가 검증은 [후속 인수인계](./PORTONE_IDENTITY_INTEGRATION_20260828.md) 참고. 아래 격리 DB 증거는 최초 구현 시점의 검증 기록이다.
- 기존 dev는 현재 운영 스키마보다 오래되어 운영 코드 기준에서 분리했다.

## 구현 범위

1. `/profile-setup`: 닉네임, 남녀 선택, 입력 시점 만 나이(19~120 정수), 시도 단위 활동 지역, 소개 범위 확인, 별도 수집·이용 동의.
2. `PUT/GET/DELETE /api/profile/basics`: 로그인 사용자 본인 정보만 조회·수정·삭제. 서버 strict validation, actual byte 제한, same-origin 검사, private/no-store 응답, DB 기반 요청 제한.
3. `profile_basics`: 신규 테이블. 기존 회원의 성별·나이·지역은 추정하지 않는다. 기존 A/B 역할 선택은 성별과 관계없다.
4. `identity_verifications`: 신규 별도 테이블. 원문 실명·전화번호·생년월일·CI/DI·OTP를 저장할 컬럼이 없다. 사용자 연결, 요청 ID, 프로필 revision, 상태, 인증사, 안내 동의 버전·요청/만료/확인 시각만 저장한다.
5. 인증 시작·완료 API와 provider/repository 계약: 클라이언트의 성공 주장 대신 인증사의 서버 검증 결과를 요구. 요청 소유자·만료·revision·안내 버전 재검사, 원문이 포함될 수 있는 provider 예외는 로그·응답에 내보내지 않는다.
6. 후보 목록, 프로필 직접 조회, private 정보, unlock 생성·조회, 메시지 조회·작성: 양측 기본 정보·온보딩·인증·소개 범위 확인 완료, 서로 다른 성별, 본인 제외 및 차단 조건을 검사한다.
7. 프로필 수정 시 이전 인증 결과를 삭제하고 새 revision을 부여한다. 메시지/unlock 작성과 기본 정보 변경은 같은 profile row lock을 사용한다. 읽기 쿼리에서도 현재 소개 조건을 재검사한다.
8. 인증 미완료자도 지원·계정 삭제에 접근 가능. 프로필 삭제·철회 시 인증 결과는 FK cascade로 삭제. 표시용 city 복사본도 삭제.
9. `npm run alpha:metrics`에 `profileRecruitment` 추가: Stage 1 초대 사용·가입 확정 계정만 남성/여성/미입력으로 구분하여 registered/verified/eligible 집계. 대기 명단 성별은 수집하지 않았으므로 `not_collected`. 역할 A/B를 성별로 환산하지 않는다.
10. API 오류 후 mock 후보/프로필로 대체하던 클라이언트 fallback 제거. 인증 거절을 성공 화면으로 바꾸지 않는다.
11. 개인정보 안내·가입 안내 업데이트. 가입 이름 입력은 닉네임으로 표시하며 실명 입력 금지를 안내한다.

## 실제 연결 상태 (후속 반영)

**PortOne V2/다날 adapter 코드는 추가했고, 실제 인증은 비활성 상태다.** `getIdentityProvider()`는 계약에 맞는 고지의 검토·게시 gate가 false이므로 null을 반환한다. 실제 실명·전화번호 입력, SMS 발송, 외부 본인인증을 했다는 뜻이 아니다.

- 운영자의 서류 확인, SMS 번호 소유 확인, 통신사 실명 본인확인은 서로 다르다. 창업자는 실명과 휴대전화 소유를 모두 인증하는 방식을 선택했다.
- 현재 계약은 실명 확인과 휴대전화 소유 확인 두 가지를 모두 충족하는 provider를 전제로 한다. SMS만 또는 수동검토를 선택하면 인증 수준·문구·모델을 명시적으로 변경해야 한다.
- 실제 서비스 연결에는 provider 계약/자격, 결제·발송 조건, 서버 자격증명, 수탁자·보유기간 고지, 발송 총비용 상한 및 번호별 남용 방지 확인이 필요하다. 입력/복귀/서버 검증 코드는 합성 응답으로만 검증했고 실인증은 미검증이다.
- 임의 성공 처리, 환경변수만으로 켜지는 인증 mock, 운영자 임의 verified API는 만들지 않았다.
- provider 도입 전에는 모든 신규/기존 실사용 계정의 소개 기능이 닫힌다. **이 상태로 main merge/Production 배포하면 알파를 사용할 수 없으므로 진행하지 않는다.**

## 개인정보·인증의 정확한 의미

- 성별·나이는 자기기입이며 실명/번호 인증으로 검증되는 항목이 아니다. 성적 지향을 확인하거나 인증하지 않는다.
- 만 나이는 저장 시점 기준. 365일 후 다시 입력·인증이 필요하다. 생년월일 저장 없이 현재 나이를 자동 계산한다고 하지 않는다.
- 인증사 화면에 직접 입력한다. 서버 결과 조회 시 이름·번호·CI/DI 등이 원문 응답에 포함될 수 있으므로 메모리에서 일시 처리한 뒤 최소 증거만 반환한다. 앱에 원문이 전혀 들어오지 않는다고 하지 않는다. 현재는 provider 비활성이라 아예 수집하지 않는다.
- 외부 인증사·통신사 보관분까지 ‘확인 후 즉시 폐기’라고 약속하지 않는다. 실제 계약·파기 조건 확정 후 안내 문구를 확정해야 한다.
- 인증 요청은 10분 뒤 무효, 다음 인증 시작에서 만료 pending 행 정리. 만료와 물리적 삭제는 다르다. 해당 행에 원문 신상은 없다.
- 소개 범위 체크만 해제해 저장하면 노출·대화는 중단되지만 기본 정보는 남는다. ‘기본 정보 삭제·소개 참여 철회’ 버튼은 기본 정보 및 인증 결과를 지운다. 닉네임·과거 대화는 계정 삭제 전까지 남는다.
- 활성 DB 삭제와 Neon 복구 이력 보유는 구분한다. 백업까지 즉시 지웠다고 하지 않는다.
- 법률 검토 참고: [개인정보 보호법 제21조](https://www.law.go.kr/LSW//lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1020398651), [개인정보 포털의 수집·이용 기준](https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=36). 법적 적합성 확정 의견은 아니다.

## Migration 계획·실행 범위

- `0009_alpha_profile_identity.sql`: 2개 테이블, FK cascade, 성별·연령·지역·상태·만료 제약.
- `0010_identity_notice_version.sql`: 인증 안내 버전 필수 컬럼. 0009를 적용한 뒤 발견한 보완이라 기존 migration을 재작성하지 않았다. 기존 인증 행에 동의를 추정해 backfill하지 않으며, 행이 있으면 적용 전 별도 정리 계획이 필요하다.
- Drizzle snapshot/journal과 EXPECTED_MIGRATION_LEDGER 갱신. 빌드 중 migration 없음.
- 별도 disposable 프로젝트의 새 브랜치에만 적용. Production DB/배포/main은 변경하지 않음.
- 직접 `db:migrate` 실행은 현재 런타임 네트워크 경로에서 완료하지 못했다. 격리 브랜치에 비어 있는 중간 생성 테이블 2개가 남은 것을 확인한 뒤, 해당 테이블에 행이 없고 ledger가 기존 2건임을 검사하고 정리했다. 이후 연결된 Neon 앱의 단일 DO 블록으로 migration SQL과 ledger 기록을 원자적으로 적용했다.
- 최종 ledger 11개. 새 기본 정보/인증 행 0, 테스트 잔존 0, 원래 fixture 계정 수 변화 없음. 표준 migrator 재실행/no-op 검증을 했다는 뜻은 아니다.

## 검증과 한계

- `npm run check`: lint, TypeScript, 단위 테스트, Next build. 최종 결과는 동봉 evidence JSON 참고.
- `guard:boundaries`, `guard:no-legacy-backend`, `git diff --check` 확인.
- 순수 정책·서비스 테스트: 미입력/미성년/임의 지역·추가 키·동의 구버전 거절, 양방향 소개, 인증사 미연결, 다른 회원 요청, 만료/미래 증거, SMS만 성공, 실명만 성공, revision 변경, 비용 한도/저장소 장애, provider 에러 누출, 허용하지 않은 redirect 차단.
- 기존 통합 suite의 fixture는 test-only helper에서만 synthetic 인증 정보를 부여한다. Production seed나 migration이 계정을 임의 인증하지 않는다.
- 격리 Neon에서 실제 Drizzle 조건을 컴파일한 `disposable-sql-checks.sql` 실행 성공: 미입력·미인증·같은 성별·본인·차단 제외, 동의 철회/revision 변경/오래된 나이 차단, DB CHECK, cascade 삭제 확인. 성공 시 모든 synthetic fixture를 내부 subtransaction으로 rollback.
- **미완료:** 실제 Node→Neon repository/HTTP 전체 통합 실행, 표준 migration runner 재실행, 동시성 drill, 인증사 실연동, exact-SHA Preview smoke, Production gate.
- Cloud Browser의 localhost 접근은 `ERR_BLOCKED_BY_CLIENT`. 브라우저 화면/수정/삭제 E2E 성공 주장 및 screenshot 없음. 실제 컴포넌트 SSR 렌더링 테스트는 별개로 실행.
- 과거 알파 gate PASS나 이 SQL 점검을 현재 출시 승인으로 재사용하지 않는다.

## 운영 승인 전 순서

1. 선택한 인증 수준에 맞는 provider 계약/개인정보 안내 확정. PortOne/다날은 코드상 연동 대상이며 계약 체결 승인을 대신하지 않는다.
2. 구현한 인증·서버 검증 adapter의 실연동. 이름·번호 원문 로그·잔존 검증, 실패/만료/재시도·타인 요청·중복/비용/번호별 abuse 테스트.
3. 네트워크 허용된 환경에서 전체 integration runner 및 동시성/삭제 drill. 새 Playwright/실브라우저 프로필 작성→인증→소개→철회 흐름.
4. 격리 Preview 환경변수·DB 확인 후 exact-SHA 배포·검증.
5. 기존 사용자 재입력 안내와 승인된 migration/deploy 순서 확정. 최신 Production 증거와 동일 SHA 운영 gate 재실행.
6. 추가 요청 제한 정책은 `closed-alpha-v3`. 예전 `closed-alpha-v2` attestation은 새 gate를 만족하지 않는다. Neon Free 예외 정책 v2와 혼동하지 않는다.

## 롤백

Production에 적용하지 않았으므로 현 운영 롤백은 필요 없다. 향후 적용 시 기존 동의/인증 결과를 자동 삭제하는 down migration은 하지 않는다. 새 기능 공개를 중단하고 영향 평가 후 code rollback을 결정한다. 이전 코드는 성별·인증 접근 제한이 없으므로, 알파 사용자가 있는 상태에서 무조건 이전 코드를 배포하면 안 된다. 먼저 초대·소개 접근을 닫고 별도 승인으로 복구한다.
