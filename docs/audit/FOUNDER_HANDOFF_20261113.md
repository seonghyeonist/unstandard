# UNSTANDARD 감사 종료 보고·인수인계서

기준: 2026-11-13 KST. 이번 문서는 감사 작업 종료 시점의 사실과 다음 변경의 경계를 고정한다.

## 판정

**감사 브랜치 수정안: CONDITIONAL PASS. 현재 운영 환경: 확인된 P1 수정 미반영.**

이번 요청에서 허용된 브랜치 수정·합성 검증·증거 정리는 종료했다. 운영 보안 문제가 모두 해소됐다는 판정은 하지 않는다. 원래 지시의 main/운영 브랜치 직접 수정, 병합, Production 배포·DB 변경 금지는 유지된다. 이번의 “잔여 마무리”를 그 금지의 철회로 해석하지 않았다.

## 최종 기준점

| 항목 | 최종 확인 |
|---|---|
| PR | [#97](https://github.com/seonghyeonist/unstandard/pull/97), OPEN/DRAFT, 미병합 |
| 검증된 런타임·시험 실행기 | 9a00dd16ea611c76f77ca7f3f2f8216cfe141a6e |
| 전체 감사 증거 포함 커밋 | e5128c206ac5f4a88adf1a9daf46853e38e91c9c |
| e5128c2 CI | [CI #288 SUCCESS](https://github.com/seonghyeonist/unstandard/actions/runs/43375109071), [Rebuild #228 SUCCESS](https://github.com/seonghyeonist/unstandard/actions/runs/43375108994) |
| Production | f5b3843494e6cfb6a87ef21339243e68d28151b9 / dpl_BvmGTnKqyuxQyZ6Aut6xwJPsk16p / READY |
| PR 비교 기준 | feat/mobile-editorial-20261105 = Production SHA |
| main | 감사 시작 확인값 30d0c78ee19d652fed2bedcae7271931f8f04b31. 다음 통합 시 갱신 필요 |

이 인수인계서 추가는 문서 변경이며 검증된 런타임을 바꾸지 않는다. PR의 최종 HEAD는 이 문서 커밋으로 이동하므로 e5128c2를 영구 HEAD라고 오인하지 않는다.

## 완료한 수정

- 외부인의 댓글로 시작할 수 있던 유료 OpenCode 실행을 OWNER 작성자로 제한했다.
- Next/eslint-config-next 16.4.2와 Zod 4.6.7을 선택적으로 적용했다. PR #95의 오래된 manifest/override는 통째로 가져오지 않았다.
- 웹훅 원문을 먼저 전부 읽던 처리를 스트리밍 제한으로 바꾸고 HMAC 바이트를 보존했다.
- 신고·메시지·잠금해제·온보딩·대기열·Preview 세션 가져오기 JSON 읽기를 제한했다. 브라우저 mutation의 Origin 검사와 내부 URL/외부 Host 차이를 보완했다.
- 온보딩 server action에도 기존 API와 같은 사용자별 rate limit을 적용했다.
- 사용하지 않는 신고 sessionStorage/서버 메모리 버퍼 2개를 제거했다. 현행 신고·삭제·동의 기능은 보존했다.
- CI의 PR 기준 브랜치 누락을 수정했다. 독립 검토에서 발견한 Origin 회귀 가능성도 수정하고 시험했다.

## 완료한 검증

| 검증 | 실제 결과와 해석 |
|---|---|
| 최종 npm run check | 410개 시험, lint, typecheck, build PASS |
| 경계·레거시 가드 | 둘 다 PASS |
| 의존성 감사 | Production 0건. 전체는 개발 도구 moderate 7건, high/critical 0건 |
| 최초 DB 통합 전체 | 29/31, 연결 시간 초과 2건으로 **FAIL 기록 유지** |
| 직접 연결 저장소 재시험 | 16/16 PASS. 이전 실패 2건 포함. 전체 runner를 PASS로 바꾸지 않음 |
| 실제 초대 동시성 | 정원·초대 소비 경합과 실패 주입 롤백 PASS |
| 로컬 Next 인증 시나리오 5종 | 이메일 증명 만료/재사용, Didit 부정 요청, 프로필·차단·철회, 회원/운영자 문의 격리, 비밀번호 재설정·세션 폐기·삭제 PASS |
| 실제 rate limit 동시성 | 30개 요청 → 20 허용 / 10 거부 / 예외 0 / 카운터 30, 정리 PASS |
| 독립 검토 | 수정 diff 검토 및 경계 시험 5개 독립 실행 PASS. 전체 보안 인증을 뜻하지 않음 |

시험 실행기의 pooler 거부 및 localhost/127.0.0.1 불일치도 기록했다. 최종 실행기는 접속 대상과 Origin을 일치시켰고, 서버 가드나 assertion은 완화하지 않았다.

## 종료·정리

실사용자 데이터 복제·공격·덤프, 실제 이메일, Live KYC, 유료 추론은 수행하지 않았다. 운영 배포·환경변수·DB·키를 변경하지 않았다.

별도 합성 프로젝트 raspy-art-18056978은 public 애플리케이션 29개 테이블 전부 0행으로 정리했고 migration ledger 17개는 보존했다. 임시 credential 파일 제거, Next 실행기·DB pool 종료를 확인했다. 프로젝트는 유지 중이며 endpoint ep-still-wildflower-bd4dwj5r는 0.25 CU / 300초 자동 정지 설정이다. 원격 프로젝트나 키 삭제·회전은 하지 않았다.

## 실제로 남은 조치 — 우선순위와 종료 조건

| 항목 | 필요한 이유 | 최소 다음 행동·종료 조건 |
|---|---|---|
| main 댓글 워크플로 반영 | issue_comment는 default main 설정을 쓰므로 브랜치 수정만으로 현재 P1이 닫히지 않음 | 별도 승인된 통합에서 OWNER gate를 default branch에 반영하고 파일·실행 조건을 읽어 확인. 유료 AI를 실제 호출할 필요 없음 |
| 운영 Next 패치 반영 | Production은 여전히 감사 전 소스 | 별도 승인된 운영 통합·배포에서 수정 소스 SHA, READY 및 도메인 연결을 확인. DB migration은 이번 수정에 필요 없음 |
| 통합 기준 정리 | main과 운영 사이 기존 237개 파일 차이가 있음 | 최신 계보를 재조회하고 변경 손실 없는 통합안을 검토. PR #97을 무심코 main으로 retarget하거나 #92/#95/#96을 일괄 병합하지 않음 |
| Preview 인가·Origin 확인 | 로컬 합성 시험은 실제 Vercel 프록시/브라우저를 증명하지 않음 | 승인된 격리 Preview에서 합성 계정으로 관련 mutation만 확인. 기존 회원·Live 재인증 사용 금지 |
| 앱 DB 역할 확인 | 메타데이터 연결의 owner 권한은 확인했지만 실제 앱 역할과 같다고 입증하지 못함 | 비밀값을 출력하지 않는 승인된 방법으로 앱 실행 역할을 확인. 역할 분리 변경은 그 결과에 따라 별도 변경으로 진행 |

운영 노출 두 항목은 새로 발견한 임의 과제가 아니라 이번 감사에서 확인된 P1의 반영 단계다. 이번 브랜치 작업이 완료됐다고 해서 자동 승인·배포로 이어지지 않는다.

## 지금 반복하거나 확대할 필요 없는 작업

- 런타임이 바뀌지 않은 상태에서 410개 시험·전체 DB suite·Live Didit을 다시 돌리지 않는다. 최초 DB 실패 기록과 직접 연결 재시험을 함께 사용한다.
- 사람의 KYC·이메일 인증을 반복하거나 기존 회원 비밀번호를 재설정하지 않는다.
- PR #95 전체 의존성 업그레이드, 광범위한 리팩터링, 무근거 코드 삭제를 시작하지 않는다.
- moderate 개발 도구 7건과 mutable action 고정은 별도 유지보수 항목이다. 현재 승인 경계 밖의 운영 변경을 우회하기 위해 이 항목을 끝없이 확장하지 않는다.
- 상표·SNS·고객 검증·심리측정·새 AI 서비스·새 MVP 구현은 이번 감사의 잔여 작업으로 부활시키지 않는다.
- 새 피벗에는 기존 사용자·세션·DB·키·동의를 이전하지 않는다. UI/유틸과 DB/CI 패턴의 재사용 등급은 상세 매트릭스를 따른다.

## 다음 실행자에게

먼저 PR #97 최신 HEAD와 Production/main 계보를 다시 읽고 위 기준과 달라졌을 때만 차이를 설명한다. 상세 발견·근거·한계는 PREPIVOT_AUDIT_20261113.md, 실제 결과는 execution-summary.json과 evidence/를 사용한다. 이미 통과한 시험을 미완료로 돌리지 않는다. 운영 변경 권한이 새로 명시되지 않았다면 병합·배포·운영 데이터·키 변경을 수행하지 않는다. 권한이 명시된 경우에도 필요한 반영과 관련 확인만 하고, 원래 감사 전체를 재시작하지 않는다.
