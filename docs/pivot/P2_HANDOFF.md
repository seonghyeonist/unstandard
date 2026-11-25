# UNSTANDARD B2C P2 인수인계

## 2026-11-25 KST Neon·Render 연결

- 허가된 전용 Neon `small-moon-39523909` / `p2-sandbox` / `unstandard_b2c`에 커밋된 Drizzle SQL 두 건을 적용했다. 로컬 직접 연결에서 DNS `EAI_AGAIN`이 발생해 Neon 트랜잭션에서 같은 잠금 ID, SQL, 마이그레이션 해시와 타임스탬프를 사용했다. 원격 원장 두 건, 앱 테이블 13개, 미적용 0건, 주문 0건을 별도 확인했다.
- DB 소유자와 Render용 `b2c_p2_runtime`을 분리했다. 런타임은 앱 테이블 13개에 SELECT·INSERT·UPDATE·DELETE가 있으며 TRUNCATE, DDL 및 마이그레이션 스키마 접근은 제외했다. 원격 합성 rate-limit 행을 생성·수정·삭제했고 남은 행은 0건이다.
- Render Free의 [격리 서비스](https://dashboard.render.com/web/srv-dc34i43rjlhs73eo21bg)에서 원격 DB를 연결한 배포 `dep-dc3d5hp9n9bc73d0p8s0`가 live. 배포 SHA `6288feca55194566c7fc7c74f4d6ff55e997d544`, `/healthz` 204, 인증 Checkout HTML 200, 무작위 합성 세션의 DB 조회 후 401, 미서명 웹훅 401을 확인했다. Render의 Polar 설정은 fixture이며 실제 결제 흐름은 별도 Actions Sandbox에서 검증한다. 이후 Blueprint 동기화에서 연결값을 덮어쓰지 않도록 해당 변수는 `sync: false`로 정의한다.
- [Polar 상태 조회 재실행](https://github.com/seonghyeonist/unstandard/actions/runs/45535181380/job/139199801801)에서 `open`, 주문 없음, 재실행 불가를 확인했다. 만료 예정은 2026-11-26 11:26:28 KST다. [GitHub Render 배포 환경](https://github.com/seonghyeonist/unstandard/settings/environments/28466542833/edit)의 `B2C_RENDER_API_TOKEN`은 비어 있다.

## 2026-11-25 KST 실행 기준

| 범위 | 판정 | 이번 실행 증거 |
|---|---|---|
| 저장소 | PASS | `main` `30d0c78ee19d652fed2bedcae7271931f8f04b31`에서 분기한 기존 스택을 확인했다. 아래 표의 각 PR은 Draft이며 현재 작업은 #100 head에만 반영했다. 복구 ZIP의 `5a6ec521`·`37b94fa1`은 시작 원격 트리에 없었다. 컨테이너와 진단 코드를 검토해 반영했다. |
| 로컬 현재 코드 | PASS | Node 24.22.3, B2C lint·typecheck·build, 단위 12/12. PG 17.12 일회용 클러스터에서 migration 두 번 및 HTTP·DB 통합 12/12. 루트 Alpha 검사 및 405/405. 클러스터 종료. |
| 원격 빌드 | PASS | [일반 push 실행](https://github.com/seonghyeonist/unstandard/actions/runs/45532393376)에서 비밀 없는 검사만 실행했다. [컨테이너 실행](https://github.com/seonghyeonist/unstandard/actions/runs/45533615635)에서 `e9da5bf25efe20af686e6c1bdff9009f624d526a`의 Docker build, revision, 접근 게이트, 미서명 웹훅 검사 통과. 앞선 실행은 이미지 build 완료 직후 초기 연결 reset에 실패했다. 재검증에는 네트워크 초기화 대기와 컨테이너 종료 로그를 추가했다. |
| Polar 임시 HTTPS | PASS | [실행 45532584590](https://github.com/seonghyeonist/unstandard/actions/runs/45532584590), SHA `01d7d1407003c15ceea9b9667e9551d6cbe8e9b0`. 이전 Checkout 만료·연결 주문 없음, 임시 HTTPS, Basic 게이트 401, 앱 화면 200, 미결제 카드 401, 신규 앱 Checkout 201, 테스트 카드 필드 입력까지 확인했다. |
| Polar 결제·환불 E2E | BLOCKED | 11:26 KST의 새 Checkout은 버튼 클릭 뒤에도 `open`, 주문 없음, Dashboard Payment Attempts 0건. 관측된 네트워크 오류는 Polar 요청의 `ERR_ABORTED` 한 건이며 실패 요청의 용도와 원인은 미확정이다. 기존 수집기가 공식 confirm 경로의 `client/` 세그먼트를 놓치는 문제는 수정했다. 승인, 유효 서명, 899센트 주문 대조, 전체 환불과 동일 구매자 세션 철회는 원격 미검증이다. |
| 정리 | PASS / 일부 미검증 | Polar 임시 웹훅 비활성화 로그와 GitHub DB 컨테이너 종료를 확인했다. 러너는 종료됐고 Checkout은 공급자 만료를 기다린다. 독립 외부 터널 재탐침은 미실행이다. |
| Render | PASS · 격리 HTTPS/fixture | [Render 서비스](https://dashboard.render.com/web/srv-dc34i43rjlhs73eo21bg) · 초기 배포 `dep-dc34i4jrjlhs73eo22c0`, exact SHA `e9da5bf25efe20af686e6c1bdff9009f624d526a`. HTTPS 204+SHA, 익명 Checkout 401, 인증 Checkout 200, 미서명 웹훅 401 확인. 전용 placeholder 설정이며 실제 DB·결제는 연결하지 않았다. 콜드 스타트의 실제 Polar 전달과 원격 롤백은 미검증이다. |
| Neon | 메타데이터 PASS · 원격 미검증 | `small-moon-39523909`, `p2-sandbox` `br-empty-sunset-beglwunj`, `unstandard_b2c`, `b2c_p2_owner`, `ep-delicate-brook-beo1qukm`, Ohio, PG17, Launch, idle. 조회에 separate runtime/migration 역할은 나타나지 않았다. 추가 비용 0을 증명할 수 없어 compute 기동과 SQL은 보류했다. |
| Vercel | BLOCKED | Alpha `unstandard-m9qj`는 팀 목록에 있었다. 브라우저의 P2 Hobby 프로젝트 `prj_dd0wFhYrOLg6LPt9LMLoYCxowZcV`는 팀 범위를 명시한 상세 API에서 404였다. 상업 운영에 Hobby를 선택하지 않았다. [Vercel Hobby](https://vercel.com/docs/plans/hobby) |
| Google Cloud | BLOCKED | 현재 세션에서 Build History에 접근할 수 없어 빌드 주체, 거절 권한, 연결 저장소와 청구 상태를 확인할 수 없었다. 계정 소유자가 콘솔 읽기 접근을 제공하면 원래 Build의 리전·ref·service account와 실패한 호출을 확인하는 단계에서 재개한다. |

| PR | Base | 작업 시작 Head | 당시 실제 diff |
|---|---|---|---|
| #98 | `f5b3843494e6cfb6a87ef21339243e68d28151b9` | `f92df39ca08b200806c0b9b50787eddea4fc7850` | 15파일, 6축 브라우저 계산·정적 B2C |
| #99 | #98 head | `48cf2886f4cc50f5e3cdecc7a9e1c779b3bd1726` | 22파일, 독립 DB·세션과 소유권 |
| #100 | #99 head | `59f2ebea7a4d7292860dfcca5b619703f29cd18c` | 43파일, Polar 결제·복구·검증. 11월 23일 검증 소스는 `5e470ca856b5740118b7d286151d550b97c3a467` |

| 앱 진입점 | 명령 또는 계약 |
|---|---|
| Node·lockfile | 24.x, `apps/b2c/package-lock.json`, `npm --prefix apps/b2c ci` |
| 정적 빌드·시작 | `npm --prefix apps/b2c run build`로 `dist` 생성. `npm --prefix apps/b2c start` → `server/start.mts` |
| 포트·health | 기본 `127.0.0.1:4173`. 격리 Sandbox의 Node 컨테이너는 `0.0.0.0`와 플랫폼 `PORT` 사용. `GET /healthz` 204 및 `X-B2C-Revision`. 프로세스 상태와 리비전을 나타낸다. |
| DB migration | `npm --prefix apps/b2c run db:migrate`. loopback은 `B2C_MIGRATE_CONFIRM=local-b2c`. 원격에서는 전용 대상 확인, 직접 endpoint, 별도 migrator 역할과 동의값 필요. 런타임 권한은 별도로 확인한다. |
| 결제·웹훅 | 활성 공급자는 Polar Sandbox. `POST /api/b2c/webhooks/polar`만 Basic 게이트 예외이며 서명을 확인한다. Finance/Production 연결은 적용하지 않았다. |
| 공유 구성 | 루트 `tsconfig.json`은 Alpha 빌드에 B2C 타입을 포함하지 않는다. 루트 `vercel.json`은 세 P2 스택 브랜치의 Alpha 자동 배포를 비활성화한다. B2C는 자체 Node 빌드를 사용한다. |
| Paddle 참조 | 브랜치명과 기존 SQL migration 파일명·저널 식별자는 호환성 보존용. Paddle 런북은 역사 자료. 활성 결제 코드는 Polar SDK를 사용한다. |

### 호스팅 판단과 반복 실행

Render Free를 $0 **격리 HTTPS**로 선택했다. 소유자가 워크스페이스에 결제수단이 없다고 확인했다. 무료 플랜은 유휴 15분 후 중지하고 다시 시작하는 데 약 1분이 필요할 수 있다. 고정 HTTPS 도달성, 서명 웹훅 전달 및 콜드 스타트 재시도는 개별 검증 항목이다. Render Starter 월 $7은 향후 검토 가격이다. Cloud Run은 무료 제공량 이후 계량 과금이며 Build·Registry·네트워크를 함께 판단해야 한다. 이 실행에서 해당 계정의 $0 및 접근 조건은 확인할 수 없었다. [Render Free](https://render.com/docs/free) · [Render 초과 사용](https://render.com/docs/faq) · [Cloud Run 가격](https://cloud.google.com/run/pricing) · [Cloud Build 가격](https://cloud.google.com/build/pricing)

- 로컬은 `npm --prefix apps/b2c ci --no-audit --no-fund`, `npm --prefix apps/b2c run check`, `B2C_PG_BIN=/path/to/pg17/bin python3 apps/b2c/scripts/test-postgres.py` 순으로 실행한다.
- GitHub push는 저장소와 정확한 P2 ref를 검사한다. 일반 push는 비밀 없는 검증만 실행한다. 기본 브랜치의 workflow 파일을 전제로 하는 `workflow_dispatch` 제약 때문에 최종 커밋 메시지 줄로 명시적으로 선택한다. `P2-Polar-Sandbox: run`과 `P2-Render-Sandbox: deploy`는 별개 선택이다. 재실행 attempt에서는 외부 변경 작업을 건너뛴다. [GitHub Actions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- Polar는 이전 Checkout의 무주문 만료·실패 또는 대조된 전액 환불 확인 이후 진행한다. 세 토큰은 기존 `p2-polar-sandbox` Environment를 사용한다. 원격 카드가 아직 생성되지 않는 P2 단계에서는 실제 paid 웹훅·원장을 확인한 뒤 일회용 DB에 개인 카드 fixture만 추가해 같은 세션의 200을 검사한다. fixture 표시는 결제 승인이나 P3 생성 증거와 별개다. 버튼 다음에는 미리 허용한 메서드·경로 분류와 HTTP 상태만 기록한다. 전체 URL, 주소, 카드 값, 토큰, 쿠키는 기록하지 않는다. [Polar Confirm API](https://polar.sh/docs/api-reference/2026-10/checkouts/confirm-checkout-session-from-client)
- Render는 Free·Ohio·동일 Git ref·Docker context `apps/b2c`·`/healthz`·자동 배포 off를 사용한다. GitHub의 `p2-render-sandbox` Environment에는 해당 작업공간 scoped 배포/읽기 권한과 필요 시 rollback/suspend 권한을 가진 `B2C_RENDER_API_TOKEN`, 서비스 ID, `B2C_RENDER_DEPLOY_CONFIRM=p2-free-no-payment-method`가 필요하다. 현재 구성에서 Actions로 토큰이 전달되는 경로는 미검증이다. 이미 같은 SHA가 live면 검증만 하고, 진행 중 배포나 같은 SHA의 실패 기록이 있으면 중복 요청을 차단한다.
- 롤백은 기존 정상 revision을 먼저 대조하고 실패 시 보존된 Deploy ID를 사용한다. 이전 정상 배포가 없는 실패는 해당 격리 서비스 중단으로 정리한다. 승인된 배포 중 타임아웃이 나면 동일 요청을 재전송하기 전에 Render Deploy ID 상태를 조회한다. 성공·기존 정상 보존·롤백·첫 배포 중단·중복·대상 오류의 제어 흐름은 합성 API 응답으로 검증했다. [Render Rollbacks](https://render.com/docs/rollbacks)

### Google Cloud 공지와 자료 보존

Gmail 공지의 시행일은 **2027-01-01**이다. 공식 General Service Terms §17은 승인된 활성 작업에 필요한 기술정보 처리, 30일 이내 보존, 도구 연결 해제 또는 접근 철회 시 보존 종료, 필요 이상의 체계적 탐색 금지를 규정한다. 조회값뿐 아니라 파생 진단에도 적용한다. GCP 작업을 나중에 자동화할 경우 실행별로 접근을 한정하고, 삭제 가능한 임시 저장소의 원본·파생본·백업을 함께 관리하며, 작업 종료 시 삭제하고 철회 시 즉시 제거한다. 이 삭제를 집행할 수 없는 채팅·장기 Git 로그·자동화 실행 로그에 기술정보를 출력하지 않는다. 이번 작업은 GCP 작업 로그를 추가 수집하거나 Git에 보존하지 않았다. [Google Cloud 약관](https://cloud.google.com/terms/service-terms)

다른 Gmail은 2026-11-16부터 $300 체험 크레딧의 Gemini 적용이 변경된다고 알렸고, 11월 7일 KST 메일은 체험이 30일 남았다고 알렸다. 정확한 종료일과 현재 잔액·청구 유형은 콘솔에서 확인해야 한다. Gemini 변경은 호스팅 비용 증거와 별개다.

### 2026-11-25 KST 재개 결과

- [Polar 읽기 전용 조회](https://github.com/seonghyeonist/unstandard/actions/runs/45535181380/job/138939926356)에서 최신 Checkout 상태 `open`, 주문 `absent`, `ready_for_rehearsal=false`를 확인했다. 공급자 만료 시각은 2026-11-26 11:26:28 KST다. 이 실행의 일반 CI도 통과했고, 결제와 배포 잡은 스킵됐다.
- P2 ref의 커밋 메시지 마지막 줄 `P2-Polar-Sandbox: status`로 상태만 조회할 수 있다. 기존 Sandbox 접근 토큰만 쓰며 Checkout·환불·웹훅을 변경하지 않는다. 만료 시각 이후 서버 상태가 `expired`이고 주문이 없음을 확인한 뒤 `P2-Polar-Sandbox: run`을 선택한다. 같은 상태·조건에서 결제를 재제출하지 않는다.
- [GitHub Render 배포 환경](https://github.com/seonghyeonist/unstandard/settings/environments/28466542833/edit)을 생성했다. 허용 브랜치 `pivot/b2c-v4-p2-paddle`, 변수 `B2C_RENDER_SERVICE_ID`와 `B2C_RENDER_DEPLOY_CONFIRM`을 확인했다. 남은 자격증명은 `B2C_RENDER_API_TOKEN`이다. 연결 후 `P2-Render-Sandbox: deploy`에서 종료와 SHA를 대조한다. 기존 live 배포의 정확한 SHA는 `f20a15909a945ef9d52a811245445efe74183c49`다.
- 기존 Neon P2 계정의 Launch 요금은 compute 사용량에 따라 과금된다. $0이 보장되는 근거가 없어 일회용 PG17 검증을 유지했다. [Neon Launch 요금](https://neon.com/docs/introduction/plans)

## 2026-11-23 이전 검증 기록

**Local Synthetic PASS · GitHub 임시 HTTPS 및 앱 Checkout PASS · Polar Sandbox E2E / Vercel Preview / Neon Remote BLOCKED.**

- 검증 소스 `5e470ca856b5740118b7d286151d550b97c3a467`, [최종 원격 실행](https://github.com/seonghyeonist/unstandard/actions/runs/45107543288/attempts/1). 시작 HEAD `3b6f5ad9def0d0f426f4d5553f9077b418a3a9fb`.
- 로컬 lint/typecheck/build, 단위 12/12, 격리 PG17 migration 2회, 통합 12/12 PASS.
- HTTPS는 할당 후 약 61초에 연결됐다. 카탈로그, Basic 401, 앱 페이지 200, 미서명 웹훅 401, 미결제 카드 401, Checkout 201, 구매자 정보 사전 입력, 카드 입력, 결제 버튼 클릭까지 확인했다.
- 버튼 클릭 후 `open` / `absent` / `pay_button_available`. Stripe·Polar 확인 응답은 관측되지 않았고 대시보드상 결제 시도 및 주문은 0건이다. 90초 뒤 `sandbox_checkout_not_confirmed`. Polar 상세의 결제 시도와 Orders 목록은 0건이다. 임시 웹훅 비활성화와 러너 DB 컨테이너 삭제를 확인했다.
- Vercel P2는 브라우저상 Hobby에서 확인된다. 정확한 ID도 API 404/403이며 Git 미연결, Root Directory 빈 값, Node 기본 26.x다. Neon Launch 전용 PG17은 식별됐고 idle이다. 계량 과금 때문에 migration을 보류했다. 스키마 조회 뒤 마지막 활동 시각이 갱신됐으며 청구액은 미확정이다.
- 호스팅은 단기 GitHub 임시 HTTPS, 상용 파일럿 전용 Render $7/월부터, Vercel 재사용이 우선이면 Pro $20/월부터를 검토한다. Hobby에서 이 사업용 Sandbox를 허용하는 명시적 근거를 확인할 수 없어 배포를 보류했다.

12:44 KST의 기존 open Sandbox Checkout 상세와 Orders부터 재대조한다. 신규 주문 생성 전에 통제된 헤디드 Chromium에서 Stripe iframe의 폼 완료·검증 상태 및 Polar/Stripe 확인 요청을 확인할 수 있는 진단을 준비한다. 기존 Checkout에서 원래 앱 구매자 세션은 종료됐으므로 결제는 제출하지 않는다. 실패 원인 또는 안전한 수정이 확보된 뒤 새 앱 Checkout으로 같은 세션 E2E를 한 번 실행한다.

[재개 프롬프트](P2_POLAR_RESUME_PROMPT.md) · [활성 런북](POLAR_SANDBOX_RUNBOOK.md)

## 이전 기록

2026-11-21 KST 갱신. P2의 결제사와 활성 런북은 [Polar Sandbox](POLAR_SANDBOX_RUNBOOK.md)로 교체됐다. 아래 2026-11-20 기록의 Paddle 배치와 초기 판정은 이전 구현의 증거다.

2026-11-20 KST 기준. 갈등 후 재연락 시점 조율 제품이다. EN/KO, 무료 6축 영수증, USD $8.99 단건, 결제자 1명과 상대 1명 무료, 결제 capture 이후 최대 14일 접근을 계약으로 한다. 무료 답변은 브라우저 메모리에 있다. 결제에는 별도 페이지와 CSP를 적용한다.

| 기준 | 결과 |
|---|---|
| 명세 | 첨부 UNSTANDARD_B2C_Master_MVP_v4.pdf 및 [Drive P2–P8 요강](https://drive.google.com/file/d/1JoqqZiuh9ZM6Mq_7RzXlwHeElak34mSa/view) |
| P0 | [PR #98](https://github.com/seonghyeonist/unstandard/pull/98) OPEN · DRAFT · 미병합. Base `feat/mobile-editorial-20261105`, head `f92df39ca08b200806c0b9b50787eddea4fc7850` |
| P1 | [PR #99](https://github.com/seonghyeonist/unstandard/pull/99) OPEN · DRAFT · 미병합. Base `pivot/b2c-v4-foundation-20261119`, head `48cf2886f4cc50f5e3cdecc7a9e1c779b3bd1726` |
| P2 | [브랜치 및 정확한 HEAD](https://github.com/seonghyeonist/unstandard/commits/pivot/b2c-v4-p2-paddle/). Draft base `pivot/b2c-v4-p1-data-session` |
| Alpha Vercel | 확인된 최신 Production 배포 READY, `dpl_BvmGTnKqyuxQyZ6Aut6xwJPsk16p`, `f5b3843494e6cfb6a87ef21339243e68d28151b9`. Branch의 Git 자동 배포 비활성 |
| Neon | 이름 검색에서 Alpha 및 감사 자원 확인. P2 독립 DB 자격증명 미확보. migration과 데이터 시험은 일회용 PostgreSQL 17.11에서 실행 |
| 판정 | **Local PASS · Paddle Simulator BLOCKED · Real Sandbox Checkout 및 환불 BLOCKED · 실제 Vercel HTTPS BLOCKED** |

[검증 매트릭스](P2_TEST_MATRIX.md) · [Sandbox 런북](PADDLE_SANDBOX_RUNBOOK.md) · [승인 기록](P2_APPROVAL_REGISTER.md) · [요약 증거](evidence/p2-results.json)

## API 및 DB 계약

| 호출 | 계약 |
|---|---|
| `POST /api/b2c/purchase-proof` 및 `/rotate` | 256비트 난수 증명 쿠키. Secure·HttpOnly·SameSite=Lax. 서버는 digest와 만료·철회를 관리 |
| `POST /api/b2c/orders` | Idempotency-Key UUID와 `{sku:"recontact-v4",locale:"en"|"ko"}`. USD 899센트 세전·수량 1을 서버에서 검사. 멱등 재호출은 같은 브라우저에 동일 거래를 반환 |
| `POST /api/b2c/orders/claim` | `{orderId}`와 브라우저 증명. 미확정 202, 확정 시 증명 소비와 P1 세션, 소비 후 404. 응답 유실은 이메일 복구 |
| `POST /api/b2c/webhooks/paddle` | 원문 SDK 서명·시각 검사 및 거래·상품 조건 대조. 이벤트·주문·방·작업 커밋 후 성공 |
| `POST /api/b2c/webhooks/paddle/simulator` | 서명 비밀이 별도인 검증 경로. 운영 권한 원장과 방을 변경하지 않음 |
| `POST /api/b2c/recovery/request`, `/claim` | 복구 요청은 존재 여부와 무관하게 동일 202. digest만 저장한 토큰으로 15분 안에 1회 교환 |
| `GET /api/b2c/me/card` | 구매자 소유 활성 방의 카드 200, 준비 전 202, 비활성 방 410 및 no-store |

Migration `0001_paddle_payment.sql`은 주문 결제 모드와 구매 증명·이메일 digest·검토 필드, 복구 토큰 및 제한 테이블을 추가한다. P1 주문은 새 필드가 NULL이다. 서명된 완료에서 최초 성공 capture 시각을 사용한다. 승인된 전액 환불과 분쟁은 방·구매 증명·복구를 철회한다. 이미 발급한 세션은 이후 열람에서 410이다. 부분 환불은 검토 표식을 남기고, 뒤늦은 완료 이벤트로 철회된 권한이 부활하지 않는다.

개인 카드 작업은 `jobs(order_id,kind,revision)`의 `personal_card`, revision 0으로 등록된다. 이메일 인덱싱 작업이 Paddle의 결제 고객을 조회해 이메일 HMAC만 저장한다. 회복 토큰 원문과 이메일은 DB에 저장하지 않는다. 메일 작업은 DB 트랜잭션 밖에서 멱등 로컬 sink로 기록된다.

Worker는 명시 실행형이다. 5분 지난 미확정 주문의 API 대조, 만료 lease 재시도 최대 3회, 24시간 미제공 환불 검토를 처리한다. Paddle 생성 응답이 유실되면 기존 거래를 대조하고 동일 주문으로 추가 거래를 생성하지 않는다. 격리 Preview의 실행 주기, 정확한 이벤트 샘플, Sandbox 이메일 전달 정책은 원격 승인 후 확인할 사항이다.

## P3 인계

P2 승인은 실제 Sandbox Checkout과 승인 환불 후 접근 철회 증거까지 확인한 뒤 판단한다. P3에는 카드 생성 및 저장 직전 구매 권한 재확인, buyer 전용 결과, EN/KO 결정론 템플릿과 72시간 안내가 남아 있다. 후속 작업에는 [인수인계 프롬프트](P2_CONTINUATION_PROMPT.md)를 사용한다.
