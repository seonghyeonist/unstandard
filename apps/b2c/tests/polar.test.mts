import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { createFetchAdapter } from "../server/fetch-adapter.mts";
import { loadPaymentConfig } from "../server/payment-config.mts";
import { hostedSandboxCheckout, PolarSandboxProvider } from "../server/polar-provider.mts";

const secret = "synthetic-only-polar-signing-secret";
const id = "00000000-0000-4000-8000-000000000001";
const origin = "https://p2.example.test";
const env = {
  B2C_ORIGIN: origin, B2C_PAYMENT_MODE: "sandbox", B2C_POLAR_ACCESS_TOKEN: "polar_oat_fixture",
  B2C_POLAR_ORGANIZATION_ID: id, B2C_POLAR_PRODUCT_ID: id, B2C_POLAR_WEBHOOK_SECRET: secret,
  B2C_PAYMENT_TOKEN_KEY: "a".repeat(64),
};

function signed(body: string, offset = 0) {
  const stamp = String(Math.floor(Date.now() / 1000) + offset);
  const signature = createHmac("sha256", secret).update(`fixture-delivery.${stamp}.${body}`).digest("base64");
  return { "webhook-id": "fixture-delivery", "webhook-timestamp": stamp, "webhook-signature": "v1," + signature };
}

test("Polar SDK verifies the raw body and rejects stale and altered signatures", async () => {
  const { provider } = loadPaymentConfig(env);
  const raw = '{ "type":"unsupported.fixture" }\n';
  assert.equal(await provider.verifyWebhook(raw, signed(raw)), null);
  await assert.rejects(provider.verifyWebhook(raw.trim(), signed(raw)));
  await assert.rejects(provider.verifyWebhook(raw, signed(raw, -301)));
  await assert.rejects(provider.verifyWebhook(raw, signed(raw, 301)));
});

test("Checkout accepts the Sandbox origin and rejects live and legacy application hosts", () => {
  assert.ok(loadPaymentConfig(env).provider instanceof PolarSandboxProvider);
  assert.throws(() => loadPaymentConfig({ ...env, B2C_PAYMENT_MODE: "live" }));
  assert.throws(() => loadPaymentConfig({ ...env, B2C_ORIGIN: "https://unstandard.app" }));
  assert.throws(() => loadPaymentConfig({ ...env, B2C_ORIGIN: "http://localhost:4173" }));
  assert.equal(loadPaymentConfig({ ...env, B2C_ORIGIN: "http://localhost:4173" }, true).origin, "http://localhost:4173");
  assert.equal(hostedSandboxCheckout("https://sandbox.polar.sh/checkout/fixture"),
    "https://sandbox.polar.sh/checkout/fixture");
  assert.throws(() => hostedSandboxCheckout("https://buy.polar.sh/checkout/fixture"));
  assert.throws(() => hostedSandboxCheckout("https://sandbox.polar.sh.evil.test/checkout/fixture"));
});

test("Web-standard adapter preserves Polar headers, body bytes and the cookie", async () => {
  const { provider } = loadPaymentConfig(env);
  const raw = '{ "type":"unsupported.fixture" }\n';
  const route = "/api/b2c/webhooks/polar";
  const app = createFetchAdapter(async (req, res) => {
    assert.equal(req.url, route);
    const parts: Buffer[] = [];
    for await (const chunk of req.iterator({ destroyOnReturn: false })) parts.push(chunk);
    const headers = Object.fromEntries(Object.entries(req.headers).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string"));
    assert.equal(await provider.verifyWebhook(Buffer.concat(parts).toString("utf8"), headers), null);
    res.setHeader("Set-Cookie", "fixture=1; Secure");
    res.writeHead(200, {});
    res.end("ok");
  });
  const response = await app(new Request(origin + route, { method: "POST", body: raw, headers: signed(raw) }));
  assert.equal(await response.text(), "ok");
  assert.deepEqual(response.headers.getSetCookie(), ["fixture=1; Secure"]);
});
