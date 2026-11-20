# UNSTANDARD B2C P2 인수인계

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
