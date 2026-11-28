# UNSTANDARD B2C P2 Polar Sandbox

## 2026-11-26 KST 진단 개선 및 재개 보류

- [장애 조사](P2_ROOT_CAUSE_REPORT.md)와 [진단 매트릭스](P2_DIAGNOSTIC_MATRIX.md)에 실행 비교 및 검증 근거를 기록했다.
- 최신 Checkout `d0aafaf7-4b83-4035-8b2f-10196d50a367`은 Polar에서 Open, Payment Attempts 0건, Orders 0건으로 확인했다. 이전 `expired` 결과로 대체할 수 없다.
- 신규 결제·환불·배포 0건. 실제 결제 승인부터 접근 철회까지는 미검증이다.

재개 시 PR 최신 SHA와 진행 중인 잡을 다시 조회한다. 먼저 읽기 전용 상태 조회로 Checkout ID, 공급자 만료 시각과 연결 주문을 대조하고 대시보드에서 Payment Attempts 및 미대조 주문을 확인한다. Open·Confirmed·진행 중 시도·불일치 발생 시 결제를 보류한다. 기존 마지막 결제 실행은 `45755155609` / `60cfe79`이다. 진단이 적용된 SHA의 CI, 비결제 폼 관측, Sandbox 카탈로그·임시 HTTPS·격리 DB, 중복 방지와 정리 경로가 모두 확인된 후에만 Pay 1회가 허용된다.

This is the active P2 runbook. It applies to the isolated Sandbox organization and the dedicated B2C runtime. The former Paddle runbook and evidence describe the earlier implementation.

## Configuration

| Location | Setting |
|---|---|
| B2C runtime | `B2C_PAYMENT_MODE=sandbox`, `B2C_ORIGIN`, `B2C_DATABASE_URL`, `B2C_EXPECT_DB_HOST` for the approved remote database, `B2C_PAYMENT_TOKEN_KEY` as a 32-byte random hex secret |
| B2C runtime | `B2C_POLAR_ACCESS_TOKEN` with `products:read`, `checkouts:read`, `checkouts:write`, `orders:read`, `customers:read`, `refunds:read`, `disputes:read` |
| B2C runtime | `B2C_POLAR_ORGANIZATION_ID`, `B2C_POLAR_PRODUCT_ID`, `B2C_POLAR_WEBHOOK_SECRET` |
| Hosted Preview | `B2C_SANDBOX_ACCESS_KEY` as a separate 32-byte random hex secret |
| Controlled E2E runner | Runtime configuration and a separate `B2C_POLAR_E2E_REFUND_TOKEN` with `refunds:write`. For hosted checks, use the same operator access secret as the Preview. |

Use an exact HTTPS origin for the hosted runtime. Loopback HTTP is supported for local execution. Vercel secrets belong to the dedicated project's Preview scope. Pass runner credentials through its secret manager. The Vercel Secret does not export its value to a runner. Keep the application origin and webhook URL stable across redeployments.

In Polar Sandbox, use a private, one-time product with one fixed USD 899-cent price. Use the app’s checkout button for the entitlement test. The standalone provider smoke checkout link does not attach an internal order ID. Keep promotional codes disabled. The product’s pre-tax amount is USD 8.99. Confirm the actual tax-adjusted amount separately.

Configure Polar to send `order.paid`, `order.updated`, `order.refunded`, `refund.created` and `refund.updated` to `/api/b2c/webhooks/polar`. Use the endpoint’s secret in the runtime. The handler checks Standard Webhooks headers and the raw body with the Polar SDK. Checkout creation stores the internal order ID in server-controlled Polar metadata. The return page polls the app's claim endpoint using the original browser's purchase proof. Buyer access is granted after the paid event and valid purchase proof. Refund handling reads successful refunds in aggregate and checks whether principal and tax are fully refunded before revoking access. A supported order or refund event also reads the associated dispute state. Keep the Alpha protection boundary.

## Verification

```sh
npm --prefix apps/b2c ci
B2C_PG_BIN=/path/to/postgresql/bin npm --prefix apps/b2c run b2c:test:all
npm --prefix apps/b2c run b2c:polar:preflight
B2C_SANDBOX_WRITE_CONFIRM=checkout-b2c-polar-sandbox npm --prefix apps/b2c run b2c:test:checkout:sandbox
```

Apply migrations in the approved database with its dedicated migrator credentials and the expected host. Start the local test server against a disposable loopback database or use the permitted standalone Preview. A local webhook relay can forward signed Sandbox traffic to the local runtime. Record the delivery and exact origin used. The remote deployment gate separately requires verification on the actual hosted origin.

The E2E script checks unpaid access, the application-backed checkout, paid order, the same browser's buyer session, successful full refund, and the same session's denial. Provider-only checkout and synthetic PostgreSQL results each have their own verdict. Declare P2 PASS after the signed event and buyer session have been verified through the intended hosted HTTPS runtime.

[Polar Sandbox](https://polar.sh/docs/integrate/sandbox) · [Checkout API](https://polar.sh/docs/api-reference/checkouts/create-session) · [Refund API](https://polar.sh/docs/api-reference/refunds/create)

## 2026-11-23 remote evidence

[Run 45107543288, attempt 1](https://github.com/seonghyeonist/unstandard/actions/runs/45107543288/attempts/1) used `5e470ca856b5740118b7d286151d550b97c3a467`. The standard runner and disposable PostgreSQL reached HTTPS after about 61 seconds from origin assignment. The app created the checkout, applied synthetic buyer and billing details, verified the card input in the browser and clicked Pay. Polar still reported open checkout and no order. Provider dashboard confirmed zero payment attempts. The workflow stopped at `sandbox_checkout_not_confirmed` and disabled the temporary webhook. Signed paid/refund ledger validation and same-session access remain blocked.

Before tunnel creation, the runner reconciles the latest product checkout against Polar Orders. The workflow permits the explicitly reconciled prior unsubmitted candidate only within its recorded timestamp window. Do not carry that exception forward without checking Payment Attempts, order history and the status of the original browser. Temporary ledger reads are restricted to the disposable loopback database. The runner uses browser-key input and logs only allowlisted state and HTTP codes. Resume with the linked [handoff](P2_POLAR_RESUME_PROMPT.md).
