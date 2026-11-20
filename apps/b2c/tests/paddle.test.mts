import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPaymentConfig } from "../server/payment-config.mts";
import { createFetchAdapter } from "../server/fetch-adapter.mts";
import { signFixture, validPayment } from "../server/payment-provider.mts";

const now = new Date();
const platformSecret = "paddle synthetic platform fixture";
const simulatorSecret = "paddle synthetic simulator fixture";
const orderId = "ddad1a8b-00ca-4c2c-81b8-d72d4a1c4017";
const priceId = "pri_" + "a".repeat(26);
const transactionId = "txn_" + "b".repeat(26);
const env = {
  B2C_PAYMENT_MODE: "sandbox",
  B2C_ORIGIN: "https://sandbox.example.test",
  B2C_PADDLE_API_KEY: "pdl_sdbx_apikey_fixture",
  B2C_PADDLE_PRICE_ID: priceId,
  B2C_PADDLE_WEBHOOK_SECRET: platformSecret,
  B2C_PADDLE_SIMULATOR_SECRET: simulatorSecret,
  B2C_PADDLE_CLIENT_TOKEN: "test_fixture",
  B2C_PAYMENT_TOKEN_KEY: "e".repeat(64),
};

const completion = {
  event_type: "transaction.completed",
  event_id: "evt_" + "c".repeat(26),
  notification_id: "ntf_" + "d".repeat(26),
  occurred_at: now.toISOString(),
  data: {
    id: transactionId, origin: "api", status: "completed", collection_mode: "automatic",
    custom_data: { b2c_order_id: orderId }, currency_code: "USD", customer_id: "ctm_" + "a".repeat(26),
    items: [{ quantity: 1, price: {
      id: priceId, unit_price: { amount: "899", currency_code: "USD" }, unit_price_overrides: [], quantity: { minimum: 1, maximum: 1 },
    } }],
    details: {
      tax_rates_used: [],
      line_items: [{ price_id: priceId, quantity: 1, unit_totals: { subtotal: "899", discount: "0", tax: "90", total: "989" } }],
    },
    payments: [{ status: "captured", captured_at: now.toISOString() }],
  },
};

test("SDK verifies original signed strings and normalizes captured pre-tax amount", async () => {
  const { provider } = loadPaymentConfig(env);
  const raw = JSON.stringify(completion, null, 2) + "\n";
  const signedAt = new Date();
  const signature = signFixture(raw, platformSecret, signedAt);
  const event = await provider.verifyWebhook(raw, signature, "platform");
  assert.ok(event && "payment" in event);
  assert.equal(event.payment.id, transactionId);
  assert.ok(validPayment(event.payment, orderId, priceId));
  assert.equal(event.payment.paidAt?.toISOString(), now.toISOString());
  await assert.rejects(provider.verifyWebhook(raw, signature, "simulator"));
  await assert.rejects(provider.verifyWebhook(raw, signFixture(raw, platformSecret, new Date(+signedAt - 60_000)), "platform"));
  await assert.rejects(provider.verifyWebhook(raw, signFixture(raw, platformSecret, new Date(+signedAt + 60_000)), "platform"));
  await assert.rejects(provider.verifyWebhook(raw.trim(), signature, "platform"));
  const simulated = JSON.stringify({ ...completion, event_id: "ntfsimevt_" + "c".repeat(26) });
  assert.ok(await provider.verifyWebhook(simulated, signFixture(simulated, simulatorSecret, new Date()), "simulator"));
  await assert.rejects(provider.verifyWebhook(simulated, signFixture(simulated, platformSecret, new Date()), "platform"));
});

test("Sandbox config rejects Live credentials, shared signing keys and Alpha hosts", () => {
  for (const extra of [
    { B2C_PAYMENT_MODE: "live" }, { B2C_PADDLE_API_KEY: "pdl_live_apikey_fixture" },
    { B2C_PADDLE_CLIENT_TOKEN: "live_fixture" }, { B2C_PADDLE_SIMULATOR_SECRET: platformSecret },
    { B2C_ORIGIN: "https://unstandard.app" }, { B2C_ORIGIN: "https://unstandard-m9qj-abc.vercel.app" },
  ]) assert.throws(() => loadPaymentConfig({ ...env, ...extra }));
});

test("web-standard function preserves webhook bytes, headers and cookie transport", async () => {
  const raw = JSON.stringify(completion, null, 2) + "\n";
  const { provider } = loadPaymentConfig(env);
  const app = createFetchAdapter(async (req, res) => {
    assert.equal(req.url, "/api/b2c/webhooks/paddle");
    const chunks: Buffer[] = [];
    for await (const part of req.iterator({ destroyOnReturn: false })) chunks.push(part);
    const signature = req.headers["paddle-signature"];
    assert.equal(typeof signature, "string");
    assert.ok(await provider.verifyWebhook(Buffer.concat(chunks).toString("utf8"), String(signature), "platform"));
    res.setHeader("Set-Cookie", "__Host-example=fixture; Secure; Path=/");
    res.writeHead(200, { "Cache-Control": "no-store" });
    res.end("verified");
  });
  const response = await app(new Request(env.B2C_ORIGIN + "/api/b2c/webhooks/paddle", {
    method: "POST", body: raw, headers: { "Paddle-Signature": signFixture(raw, platformSecret, new Date()) },
  }));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "verified");
  assert.equal(response.headers.get("set-cookie"), "__Host-example=fixture; Secure; Path=/");
  assert.equal(response.headers.get("cache-control"), "no-store");
});
