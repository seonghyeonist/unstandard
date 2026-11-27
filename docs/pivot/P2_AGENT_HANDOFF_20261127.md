# UNSTANDARD B2C P2 인수인계 및 통합 실행 프롬프트

2026-11-27 KST · [Draft PR #100](https://github.com/seonghyeonist/unstandard/pull/100) · `pivot/b2c-v4-p2-paddle` → `pivot/b2c-v4-p1-data-session`

**PARTIAL PASS / BLOCKED.** 기존 Checkout의 만료와 무주문을 대조한 뒤 새 Polar Sandbox 리허설 1회를 실행했다. 새 Checkout은 마지막 API 조회에서 `open`, 연결 주문 없음이다. 만료 예정은 **2026-11-28 13:55:32.313 KST**다. 이 시각까지 진행 중 거래를 계속 대조할 수 있다. 신규 Checkout은 동일 ID가 종료됐거나 해당 거래가 전액 환불로 대조된 이후에만 검토한다.

## 사실 확인과 이번 실행

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 직전 인수인계 | `d925ddd`는 11월 26일 인수인계 Markdown 한 파일만 추가. 정확한 SHA의 체크 및 Docker 통과. 상태 조회·결제·배포 잡은 스킵 | [커밋](https://github.com/seonghyeonist/unstandard/commit/d925dddee9b8503bfaa48091ed621ce04150d9e8) · [CI](https://github.com/seonghyeonist/unstandard/actions/runs/45800966350) |
| 직전 Hosted 필드 검사 | 번호·만료일·CVC의 빈 값/잘못된 값/유효한 값 대조. 빈 값에도 `aria-invalid=false`, 잘못된 값은 `true`. 비읽기 요청 42개 차단, Pay 0회 | [검사 잡](https://github.com/seonghyeonist/unstandard/actions/runs/45767429114/job/139731613423) |
| 기존 거래 대조 | `d0aafaf7-4b83-4035-8b2f-10196d50a367`, 13:51:58 KST API `expired`, 무주문, 재개 가능. Sandbox UI Payment Attempts 0건 및 Orders 0건 | [상태 잡](https://github.com/seonghyeonist/unstandard/actions/runs/45942361391/job/140319305762) |
| 새 리허설 | Attempt 1, SHA `6cc83298ee051a27140b4363d2b651137055edd8`. 일반 체크 성공, 배포 스킵. 임시 HTTPS와 접근 게이트 통과, 앱 Checkout 201, Hosted 진입 및 청구 정보 반영, 카드 3개 `publicly_valid`, Pay 클릭 호출 1회 완료 | [리허설 잡](https://github.com/seonghyeonist/unstandard/actions/runs/45942446362/job/140319790558) |
| 새 거래의 마지막 대조 | `76e2d82a-a4eb-4a96-bc07-c938fb373d59`, 13:55:32.313 KST 생성. 13:58:19 KST API `open`, 무주문, 재개 불가. Sandbox UI Payment Attempts 0건 및 Orders 0건 | [상태 잡](https://github.com/seonghyeonist/unstandard/actions/runs/45942956882/job/140321166059) · [Checkout 상세](https://sandbox.polar.sh/dashboard/unstandard/sales/checkouts/76e2d82a-a4eb-4a96-bc07-c938fb373d59) · [Orders](https://sandbox.polar.sh/dashboard/unstandard/sales) |
| 인프라 | Render `unstandard-b2c-p2` Free, 자동 배포 off, 최근 live 배포 SHA `0a935d1`. Neon P2 브랜치 `br-empty-sunset-beglwunj` ready. Vercel 커넥터 목록에 `unstandard-m9qj`만 조회됨. 결제 리허설은 Actions 임시 HTTPS·일회용 PG17을 사용 | [Render 배포](https://dashboard.render.com/web/srv-dc34i43rjlhs73eo21bg/deploys/dep-dc3dj3m8bjmc73fcudv0) |
| 실제 결제 이후 단계 | 주문 승인, 서명 paid/refund 이벤트, 원장, 구매자 카드 200, 전액 환불 및 같은 쿠키의 철회 미검증. 임시 웹훅 비활성화와 러너 컨테이너 정리 로그 확인 | [리허설 잡](https://github.com/seonghyeonist/unstandard/actions/runs/45942446362/job/140319790558) |

신규 Checkout 1건, Pay 클릭 호출 1회, Polar 승인 주문 0건, 환불 0건, 배포 0건, 추가 유료 리소스 및 실거래 $0. Gmail 실패 알림은 11월 26일 결제 실패와 11월 25일 컨테이너 실패를 함께 포함한다. 결제 진단은 각 잡의 실제 로그를 기준으로 한다. 연결된 Polar 커넥터 조직 ID가 워크플로 Sandbox 조직과 달라 해당 커넥터의 404·빈 배열은 이 거래 판단에 쓰지 않았다.

## Pay 직후 실제 관측

| 시점 | 브라우저/공급자 증거 |
| --- | --- |
| Pay 기준 | 관측 시작 14,041ms에 `pay_click_started`. 27ms 뒤 클릭 호출 완료. 같은 시점에 DOM 관측기에서는 `trusted_click=false`, `native_submit=false` |
| +260ms | 공급자 `open` / 주문 없음. 화면 `pay_button_available` |
| +약 0.26초 이후 | Stripe child frame 미분류 POST 여러 건 HTTP 200. 요청 용도 미확정 |
| +752ms | Polar main frame 미분류 `POST/fetch` 시작. 시작 후 3,000ms에 `net::ERR_ABORTED`, 관측된 HTTP 응답 없음 |
| 종료 | 약 90초 후 `sandbox_payment_submission_unclassified`. 완료 로그에서 임시 웹훅 비활성화 확인 |

Playwright 클릭 호출 완료와 버튼/폼의 이벤트 수집 결과를 각각 보존한다. DOM 신호가 모두 false인 이유는 미확정이다. 미분류 POST가 확인, 폼 갱신, 기타 요청 중 무엇인지는 기존 로그로 확정할 수 없다. 3,000ms는 관측값이다. 요청 중단 주체나 타임아웃 원인에 대한 결론은 보류한다. 기존 타임라인은 940개 이벤트가 한도 때문에 빠졌다.

이번 코드 변경은 `checkout-observation.mts`와 기존 단위 테스트를 대상으로 한다. Pay 이후 Polar/Stripe 쓰기를 별도 배열에 보존한다. 번호로 요청과 결과를 연결하고, 고정 어휘만 남긴 호스트·경로 형태 및 Next.js Server Action 헤더 존재 여부를 기록한다. 헤더 값·쿼리·본문·동적 경로는 기록하지 않는다. 로컬에서 기존 진단 테스트 2개와 `git diff --check`를 통과했다. 이 보강으로 실제 Hosted Checkout에서 어떤 경로가 관측되는지는 다음 리허설에서 검증한다.

## 복사해서 실행할 프롬프트

```text
너는 UNSTANDARD B2C P2 결제·QA 실행 담당자다. seonghyeonist/unstandard Draft PR #100과 pivot/b2c-v4-p2-paddle에서 작업한다. $0 추가 지출, Polar Sandbox와 합성 데이터, P2의 가역 가능한 수정·검증·커밋·Draft PR 갱신 권한을 위임받았다. main, Alpha, Production, Live, DNS, 실제 고객 DB, 유료 플랜 및 PR 병합은 실행 범위 밖이다. 다음 작업의 목표는 Pay 이후 중단되는 Polar 요청의 역할과 실패 지점을 증거로 확정하고, 가능한 경우 실제 Sandbox 주문 1건을 환불·동일 세션 접근 철회까지 검증하는 것이다.

1. 시작 기준을 고정한다. PR #100 최신 SHA와 base, .github/workflows/p2-polar-sandbox.yml, docs/pivot/evidence/p2-results.json, 이 문서와 최신 브랜치 Actions 상태를 확인한다. 운영 기준은 이번 실제 릴리스 후보가 아닌 P2 Sandbox다. 11월 27일 실제 런은 45942446362 / 140319790558 / attempt 1 / 6cc83298ee051a27140b4363d2b651137055edd8. 읽기 전용 최신 대조는 45942956882 / 140321166059다. 푸시 실행 목록을 확인한다. PR 이벤트만 조회하는 커넥터의 빈 목록으로 동시 실행 부재를 판단하지 않는다.
2. 기존 Checkout 76e2d82a-a4eb-4a96-bc07-c938fb373d59은 마지막에 open·무주문이고, 공급자 만료 예정은 2026-11-28 13:55:32.313 KST다. 그 시각 이후 Sandbox API의 읽기 전용 P2-Polar-Sandbox: status를 사용한다. 만료된 건에 Inspect-Hosted-Fields 표식을 붙이지 않는다. API에서 정확한 ID/조직/상품, 종료 상태, 연결 주문·환불을 확인하고 대시보드의 Payment Attempts와 Orders, Actions의 동시 실행을 대조한다. 같은 이름의 다른 Polar 조직은 이 거래를 증명할 수 없다. open, confirmed, unpaid, 진행 중 결제 시도, 불일치, 미대조 주문이 있으면 신규 제출을 보류한다. 이미 paid면 기존 주문과 웹훅·접근·정리 상태를 추적하고 일회용 환경이 종료됐다면 남은 검증을 미확정으로 남긴다.
3. 만료 대기 중에는 합성 Chromium으로 실제 클릭 위치와 document capture의 trusted click, 기존 버튼 교체 여부, native submit을 분리 검증한다. 기존 false 신호는 단독 결론으로 쓰지 않는다. checkout-observation.mts의 post_pay_provider_writes, request_id, path_shape, next_action, elapsed/HTTP/오류 및 누락 카운터가 비밀 없이 수집되는지 합성 케이스와 CI로 확인한다. fixture에 원문 URL·쿼리·헤더 값·카드·쿠키·본문을 남기지 않는다. 승인 경로의 matcher 또는 대기 시간을 추측으로 바꾸지 않는다.
4. 만료/실패 및 무주문, 또는 동일 주문의 완료된 전액 환불이 대조되고 결제·Actions 진행 중 건이 없을 때만, 새 진단 코드의 정확한 SHA로 P2-Polar-Sandbox: run을 1회 명시 선택한다. 배포 표식은 사용하지 않는다. 정상 Checkout 201, 정확한 조직/상품·USD 899센트·수량 1, Sandbox 토큰 범위, 임시 HTTPS·서명 웹훅·일회용 PG17, 관측기, 공개 카드 필드 및 청구 상태를 확인한다. Pay 호출은 1회다. 동시에 새로운 연결 주문, Payment Attempts, provider status를 확인한다.
5. 메인 프레임 POST의 허용된 route shape와 next_action 여부를 시작·종료 ID에 묶는다. Polar 확인 API나 Server Action으로 확인되면 응답 또는 abort와 Checkout/Order 전이를 연결한다. 기타 요청이면 확인 요청이 시작됐는지 별도로 판단한다. 반복된 정확한 3초는 클라이언트 코드, 브라우저 요청 취소 또는 공급자 측 로그로 뒷받침될 때만 원인으로 확정한다. 성공한 Stripe child POST나 native submit 부재만으로 승인 또는 오류를 추정하지 않는다. 재현 후에도 확인이 안 되면 동일 거래를 재클릭하지 말고 타임스탬프·Sandbox Checkout ID·가린 경로 형태의 지원 문의 초안을 인수인계한다. 로그 부족을 수정 없이 반복 실행하는 이유로 쓰지 않는다.
6. paid이면 동일 앱 주문 ID, Checkout ID, Polar 주문 ID, 단일 주문, 조직·상품, 수량 1, USD 세전 899센트, 할인 0, 세금과 총액을 대조한다. 실제 서명 paid 이벤트의 수신·검증과 paid 원장을 확인한다. 동일 구매자 세션 카드 API 200과 별도 세션 차단을 확인한다. 202는 생성 대기다. P3 카드가 없어 fixture를 쓰면 paid 및 원장 확인 후 일회용 DB에만 넣고 그 사실을 기록한다. 금액·이벤트·원장·접근이 모두 맞을 때만 실제 Sandbox 전액 환불 검증을 진행한다. 중간 불일치는 거래 정리와 제품 검증을 별도로 기록한다.
7. 동일 주문의 전액 환불 성공·원금·세금, 실제 서명 환불 이벤트와 refunded/revoked 원장, 카드 200을 받았던 바로 그 쿠키의 접근 차단을 확인한다. 게이트 인증 실패, 네트워크 오류, 세션 교체는 철회 증거로 인정하지 않는다. 기존 중복 및 역순 이벤트 합성 회귀, 임시 웹훅·DB·터널 정리를 기록한다. P2 VERIFIED PASS는 이 단계까지 실제 증거가 연결됐을 때만 부여한다. P3 구현은 P2 통과 후 시작한다. Render의 고정 HTTPS는 별도 호스팅 검증으로 기록한다.
8. PR과 증거 파일에 정확한 SHA, run/attempt/job, Checkout·Order 및 각 단계의 결과를 남긴다. Checkout 신규 건수, 클릭 호출, 공급자 결제 시도, 승인 주문, 환불, 배포를 서로 구분한다. 하나의 실패 원인을 추정으로 모든 계층에 적용하지 않는다. 게이트가 막히면 막힌 실제 상태, 필요한 추가 증거, 가능한 다음 시각을 남기고 독립 작업을 완료한다.
```
