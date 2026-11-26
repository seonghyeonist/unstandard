# UNSTANDARD B2C P2 인수인계 · 2026-11-26 KST

## 현재 판정과 다음 실행 시점

**PARTIAL PASS / BLOCKED.** 새 진단기가 실제 Stripe 카드 필드의 유효성 신호를 읽을 수 있다는 점까지 검증했다. 결제 제출 이후 공급자 주문이 생성되는지는 아직 검증되지 않았다. 가장 빠른 다음 작업은 기존 Checkout의 만료 예정 시각인 **11월 27일 13:29:17.454 KST 이후**, 동일 ID의 상태와 주문을 조회하는 것이다. 시간 경과만으로 재시도 조건이 충족되지는 않는다.

| 대상 | 마지막으로 확인한 사실 | 근거 |
|---|---|---|
| GitHub | 작성 시점 Draft PR #100, head `333069246842c8b474cfe757d4fe1096469e85ea`, base `pivot/b2c-v4-p1-data-session`, 작업 브랜치 `pivot/b2c-v4-p2-paddle` | [PR](https://github.com/seonghyeonist/unstandard/pull/100) |
| 마지막 결제 제출 | SHA `60cfe79`, 11월 26일 앱 Checkout 201, Hosted Checkout 진입, 카드 입력, Pay 클릭 후 약 90초 동안 Open·무주문. 임시 웹훅 비활성화 확인 | [결제 잡](https://github.com/seonghyeonist/unstandard/actions/runs/45755155609/job/139692211031) |
| 최근 거래 관측 | Checkout `d0aafaf7-4b83-4035-8b2f-10196d50a367`, 11월 26일 13:29:17 KST 생성. 15:20 KST 검사 전후 Open·연결 주문 없음. 대시보드 Payment Attempts 0건 | [상태·필드 실측](https://github.com/seonghyeonist/unstandard/actions/runs/45767429114/job/139731613423) |
| 기존 회귀 | B2C 단위 14개, PostgreSQL 통합 12개, Alpha 405개 및 빌드 PASS. 최종 문서 SHA에서도 일반 CI와 Docker smoke PASS. 결제·배포 잡은 skipped | [CI](https://github.com/seonghyeonist/unstandard/actions/runs/45767582032) |
| 인프라 | 결제 실패 실행은 Actions의 임시 HTTPS와 일회용 PostgreSQL을 사용했다. Render Free와 Neon P2 연결은 별도 검증 경로다 | [Render 성공 실행](https://github.com/seonghyeonist/unstandard/actions/runs/45617379661/job/139216679258) |

## 무엇이 해결됐고 무엇이 남았는가

1. 기존 실행기는 카드 입력 후에 리스너를 등록했고 일부 POST만 분류했다. 지금은 Context 생성 직후부터 요청·응답·실패, 프레임, 페이지 오류를 기록한다. Pay 컨트롤의 trusted click, native submit, 공급자 상태를 별도로 기록한다. 이전의 미분류 `ERR_ABORTED`만으로 Stripe 거절이나 Polar 장애를 확정할 수 없다.
2. 실제 Checkout에서 카드번호·만료일·보안코드 각각 빈 값, 잘못된 값, 정상 테스트 값을 비교했다. 빈 필드와 정상 필드 모두 aria-invalid=false였고, 세 음성 대조군은 true였다. 따라서 Pay 직전에는 blur 이후 필드별 기대값 일치와 공개 유효성 신호를 함께 요구한다. 이 실측은 비읽기 요청 42개를 가로채고 Pay 0회로 종료했다. 정상 결제 네트워크 동작은 다음 리허설에서 관측해야 한다.
3. 남은 최초의 인과적 공백은 **정상 폼에서 Pay 1회 → 어떤 요청이 시작·완료됐는지 → Polar가 시도와 주문을 기록했는지**다. 그 뒤 서명 웹훅, 원장, 구매자 카드 읽기, 전액 환불, 동일 세션 철회가 차례로 남는다.
4. 11월 25일 Checkout의 expired 기록, 성공한 읽기 전용 잡, 합성 환불 테스트는 서로 다른 증거다. 다음 실행에서는 SHA, run/attempt/job ID, Checkout ID, 앱 주문 매핑을 한 묶음으로 보존한다. 공급자 주문과 앱의 로컬 주문을 구별한다.

## 빠른 소스 탐색

| 조사할 경계 | 먼저 볼 파일 |
|---|---|
| 트리거, 동시성, 실행 및 재실행 조건 | `.github/workflows/p2-polar-sandbox.yml` |
| 직전 Checkout 대조, 임시 터널·웹훅 설정과 정리 | `apps/b2c/scripts/polar-tunnel-rehearsal.mts` |
| 제출 직전 폼, 승인 대기, 카드 읽기와 환불 | `apps/b2c/scripts/checkout-sandbox.mts` |
| 요청 분류·오류·DOM 이벤트 해석 | `apps/b2c/scripts/checkout-observation.mts` |
| 공급자 이벤트 변환, 원장·세션 | `apps/b2c/server/polar-provider.mts`, `payments.mts`, `payment-http.mts` |
| 검증·재개 기록 | `docs/pivot/P2_DIAGNOSTIC_MATRIX.md`, `P2_ROOT_CAUSE_REPORT.md`, `P2_POLAR_RESUME_PROMPT.md`, `evidence/p2-results.json` |

## 독립적으로 복사해 사용할 통합 프롬프트

```text
너는 UNSTANDARD B2C P2 결제·QA 실행 담당자다. 저장소 seonghyeonist/unstandard의 Draft PR #100, 브랜치 pivot/b2c-v4-p2-paddle에서 작업한다. 목표는 실제 Polar Sandbox 거래 하나를 앱의 정상 경로로 추적해 전액 환불과 동일 구매자 세션의 접근 철회까지 입증하는 것이다. 이미 위임된 조회, P2 수정, 검증, 커밋 및 Draft PR 갱신은 자율 실행한다. 추가 지출 $0, Sandbox·합성 데이터만 허용한다. main, Alpha, Production, Live, DNS, 실제 고객 DB, 유료 플랜 변경과 PR 병합은 범위 밖이다.

1. 최신 기준을 고정한다. 인수인계 기준 SHA 333069246842c8b474cfe757d4fe1096469e85ea 이후 변경을 먼저 읽는다. PR head/base/draft, 해당 브랜치의 진행 중·대기 중 Actions, 마지막 실제 결제 잡과 상태 조회 잡을 구분한다. 마지막 Pay 실행은 45755155609, 최신 필드 실측은 45767429114다. 문서만 바뀌었으면 기존 카드 필드 실측과 인프라 검증을 반복할 필요가 없다.

2. 거래부터 대조한다. 기존 Checkout d0aafaf7-4b83-4035-8b2f-10196d50a367의 만료 예정은 2026-11-27 13:29:17.454 KST다. 해당 시각 이후 일반 읽기 전용 상태 조회로 실제 ID·상태·연결 주문·환불을 읽는다. 워크플로에서 확인한 커밋 끝줄 P2-Polar-Sandbox: status를 사용한다. 만료 후에는 필드 검사 표식을 붙이지 않는다. Sandbox 대시보드의 Payment Attempts와 동일 상품의 미대조 주문도 확인한다. 연결 도구 404만으로 거래가 없다고 판정하지 않는다. 최신 ID가 달라지면 두 거래 모두 대조한다. Open, Confirmed, unpaid, 진행 중 시도 또는 불일치가 있으면 신규 제출을 보류한다. 이미 paid면 기존 주문과 접근·정리 상태부터 조사한다.

3. 기존 거래가 무주문 expired/failed 또는 전액 환불로 대조되고 진행 중 시도·미대조 주문·중복 실행이 없을 때 다음 단계로 간다. 실제 실행 SHA를 고정하고 정확한 Sandbox 조직·상품·가격, 세전 USD 899센트, 수량 1, 임시 HTTPS·웹훅, 일회용 PostgreSQL, 정리 및 지연 주문 대조 경로를 확인한다. 일반 CI 결과와 합성 진단 결과를 확인한다. 조건 충족 후 기존 워크플로의 P2-Polar-Sandbox: run 트리거로 1회 실행하고 실제 rehearsal 잡과 종료 로그까지 확인한다. 일반 문서 커밋에 트리거를 넣지 않는다. 재실행 attempt에서 잡이 skipped되면 결제 증거로 세지 않는다.

4. 앱의 정상 Checkout 생성과 구매 증명을 사용한다. 카드번호·만료일·보안코드의 기대값과 blur 후 공개 유효성, 청구 필드 및 버튼 상태를 확인한다. 조건 충족 시 Pay 정확히 1회. 브라우저 이벤트, 분류된 확인 요청 및 미분류 write, HTTP 응답·중단 시각, 공급자 Checkout·Order·Payment Attempts를 같은 시간축에서 대조한다. 읽기 전용 검사에 썼던 비읽기 요청 차단은 결제 리허설에 적용하지 않는다.

5. 폼 오류면 해당 필드에서 멈춘다. 클릭은 관측됐지만 요청이 없으면 DOM·JS·프레임·미분류 요청을 먼저 조사한다. native submit 부재만으로 JS 제출 실패를 단정하지 않는다. 요청이 중단되거나 HTTP 오류가 있으면 해당 요청 분류·상태와 공급자 결과를 연결한다. Confirmed나 unpaid면 추가 제출 없이 조회한다. 동일 Checkout 재클릭, 근거 없는 시간 연장·동일 재시도를 하지 않는다. 두 번째 신규 제출은 첫 실패를 설명하는 새 증거와 검증된 수정이 있고 모든 게이트를 재통과할 때만 허용한다. 한 세션 총 신규 제출 최대 2회.

6. paid이면 Checkout ID·앱 주문·조직·상품·수량·통화·세전 899센트·세금·총액·중복 여부를 대조한다. 실제 서명 웹훅과 원장 paid를 확인하고 동일 구매자 세션의 카드 200 읽기와 제3자 차단을 검증한다. 202는 대기다. P3 카드가 없어 fixture를 쓰면 실제 paid 및 원장 확인 후 일회용 DB에만 넣고 결과에 명시한다. 금액·원장·읽기가 불일치하면 환불을 정상 E2E로 강행하지 말고 안전한 거래 정리를 별도로 기록한다.

7. 동일 주문을 Sandbox에서 전액 환불한다. 원금·세금과 공급자 성공, 실제 서명 환불 이벤트, refunded 원장, 환불 전에 읽었던 동일 세션의 접근 차단을 대조한다. 세션 교체·인증 게이트·네트워크 오류를 철회로 판정하지 않는다. 뒤늦은 paid 이벤트에 대한 기존 멱등성·철회 회귀도 확인한다. 임시 웹훅과 터널 정리 결과를 기록한다.

8. Draft PR #100과 P2_HANDOFF, P2_TEST_MATRIX, P2_DIAGNOSTIC_MATRIX, P2_ROOT_CAUSE_REPORT, P2_POLAR_RESUME_PROMPT, evidence/p2-results.json 중 변경된 사실을 갱신한다. 최신 SHA, run/attempt/job, 신규 제출·환불 횟수, 단계별 실제/합성 증거, 정리 결과와 다음 행동을 남긴다. 토큰·쿠키·카드 데이터·비밀 Checkout URL·원문 네트워크 본문은 보존하지 않는다. 모든 실제 단계가 입증되면 VERIFIED PASS, 외부 상태나 접근 때문에 막히면 PARTIAL PASS / BLOCKED, 확인된 미수정 결함은 FAIL로 보고한다. P3 착수는 P2 판정 이후다.
```