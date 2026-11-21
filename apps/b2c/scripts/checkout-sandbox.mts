import { randomUUID } from "node:crypto";
import { chromium, type Page } from "@playwright/test";
import { createPolar } from "@polar-sh/sdk/2026-10";
import { loadPaymentConfig } from "../server/payment-config.mts";
import { hostedSandboxCheckout } from "../server/polar-provider.mts";
import { allowWrites, Blocked, delay, required, summarize } from "./sandbox-helpers.mts";

function stage(name: string, status = "PASS", httpStatus?: number) {
  console.log(JSON.stringify({ layer: "polar_sandbox_checkout", status, stage: name, http_status: httpStatus }));
}

async function waitFor<T>(read: () => Promise<T | undefined>, timeout: number, reason: string) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const result = await read();
    if (result !== undefined) return result;
    await delay(2000);
  }
  throw new Blocked(reason);
}

async function cardField(page: Page, label: RegExp) {
  return waitFor(async () => {
    for (const frame of page.frames()) {
      if (new URL(frame.url() || "about:blank").origin !== "https://js.stripe.com") continue;
      const field = frame.getByRole("textbox", { name: label }).first();
      if (await field.isVisible()) return field;
    }
  }, 15_000, "sandbox_test_card_field_unavailable");
}

await summarize("polar_sandbox_checkout_refund", async () => {
  allowWrites("checkout-b2c-polar-sandbox");
  const { origin, provider } = loadPaymentConfig(process.env, true);
  const organizationId = required("B2C_POLAR_ORGANIZATION_ID");
  const refundToken = required("B2C_POLAR_E2E_REFUND_TOKEN");
  if (!/^polar_oat_[a-z0-9_-]+$/i.test(refundToken) || refundToken === required("B2C_POLAR_ACCESS_TOKEN")) {
    throw new Error("separate_sandbox_refund_token_required");
  }
  const refundClient = createPolar({ accessToken: refundToken, environment: "sandbox", timeout: 10 });
  const local = new URL(origin).protocol === "http:";
  const accessKey = local ? null : required("B2C_SANDBOX_ACCESS_KEY");
  if (accessKey && !/^[a-f0-9]{64}$/i.test(accessKey)) throw new Error("invalid_sandbox_access_key");
  if (!local) {
    const anonymous = await fetch(origin + "/checkout", { redirect: "error", signal: AbortSignal.timeout(12_000) });
    stage("anonymous_checkout_probe", anonymous.status === 401 ? "PASS" : "FAIL", anonymous.status);
    if (anonymous.status !== 401) throw new Blocked("sandbox_checkout_gate_not_reachable");
  }
  await provider.validateCatalog();
  stage("sandbox_catalog");
  const browser = await chromium.launch({ executablePath: process.env.B2C_BROWSER })
    .catch(() => { throw new Blocked("sandbox_browser_launch_failed"); });
  stage("browser_launched");
  try {
    const context = await browser.newContext({ locale: "en-US",
      httpCredentials: accessKey ? { username: "b2c", password: accessKey, origin } : undefined });
    const page = await context.newPage();
    const pageReply = await page.goto(origin + "/checkout", { timeout: 15_000 })
      .catch(() => { throw new Blocked("sandbox_checkout_page_not_reachable"); });
    stage("app_checkout_page", pageReply?.status() === 200 ? "PASS" : "FAIL", pageReply?.status());
    if (pageReply?.status() !== 200) throw new Blocked("sandbox_checkout_page_access_not_verified");
    const before = await context.request.get(origin + "/api/b2c/me/card");
    stage("unpaid_card_api", before.status() === 401 ? "PASS" : "FAIL", before.status());
    if (before.status() !== 401) throw new Error("unpaid_card_access_expected_401");
    const orderReply = page.waitForResponse((reply) =>
      reply.url() === origin + "/api/b2c/orders" && reply.request().method() === "POST", { timeout: 20_000 });
    await page.getByRole("button", { name: "Open Sandbox checkout" }).click({ timeout: 10_000 });
    const order = await orderReply;
    stage("app_create_checkout", order.status() === 201 ? "PASS" : "FAIL", order.status());
    if (order.status() !== 201) throw new Error("sandbox_order_create_failed");
    const { transactionId, checkoutUrl } = await order.json() as { transactionId: string; checkoutUrl: string };
    await page.waitForURL(hostedSandboxCheckout(checkoutUrl), { timeout: 20_000 })
      .catch(() => { throw new Blocked("sandbox_hosted_checkout_not_reached"); });
    stage("polar_checkout_opened");
    const email = `p2-smoke-${randomUUID()}@example.com`;
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await (await cardField(page, /Card number/i)).fill("4242424242424242");
    const year = String(new Date().getUTCFullYear() + 3).slice(-2);
    await (await cardField(page, /Expir/i)).fill("12" + year);
    await (await cardField(page, /Security code|CVC/i)).fill("123");
    await page.getByRole("textbox", { name: "Cardholder name" }).fill("Sandbox Buyer");
    const street = page.getByRole("textbox", { name: "Street address", exact: true });
    if (await street.isVisible()) {
      await street.fill("123 Test Street");
      await page.getByRole("textbox", { name: "Postal code" }).fill("10001");
      await page.getByRole("textbox", { name: "City" }).fill("New York");
      const state = page.locator('button[role=combobox]').filter({ hasText: /^State$/ });
      if (await state.isVisible()) {
        await state.click();
        await page.getByRole("option", { name: "New York", exact: true }).click();
      }
    }
    try {
      await page.getByRole("button", { name: "Pay now", exact: true }).click({ timeout: 15_000 });
    } catch {
      throw new Blocked("sandbox_checkout_control_unavailable");
    }
    stage("test_card_submitted");
    const paid = await waitFor(async () => {
      const { items } = await provider.client.orders.list({ organization_id: organizationId, checkout_id: transactionId, limit: 2 });
      if (items.length > 1) throw new Error("duplicate_sandbox_order");
      return items[0]?.paid ? items[0] : undefined;
    }, 90_000, "sandbox_checkout_not_confirmed");
    if (paid.currency.toUpperCase() !== "USD" || paid.subtotal_amount !== 899 || paid.discount_amount !== 0) {
      throw new Error("sandbox_order_contract_mismatch");
    }
    console.log(JSON.stringify({ layer: "polar_sandbox_checkout", status: "PASS", stage: "provider_order_paid" }));
    await waitFor(async () => {
      if (new URL(page.url()).origin !== origin) return undefined;
      const card = await context.request.get(origin + "/api/b2c/me/card");
      return card.status() === 202 || card.status() === 200 ? card.status() : undefined;
    }, 90_000, "sandbox_signed_webhook_or_claim_not_confirmed");
    console.log(JSON.stringify({ layer: "polar_sandbox_checkout", status: "PASS", stage: "same_browser_access_granted" }));
    const refund = await refundClient.refunds.create({
      order_id: paid.id, amount: paid.net_amount, reason: "customer_request", revoke_benefits: true,
    });
    await waitFor(async () => {
      const { items } = await provider.client.refunds.list({ id: refund.id, order_id: paid.id, succeeded: true });
      return items.some((item) => item.id === refund.id && item.status === "succeeded" &&
        item.amount >= paid.net_amount && item.tax_amount >= paid.tax_amount) ? true : undefined;
    }, 180_000, "sandbox_full_refund_not_confirmed");
    console.log(JSON.stringify({ layer: "polar_sandbox_checkout", status: "PASS", stage: "full_refund_succeeded" }));
    const revoked = await waitFor(async () => {
      const reply = await context.request.get(origin + "/api/b2c/me/card");
      if (reply.status() === 410) return 410;
      if (reply.status() === 401 && (await reply.json()).error === "unauthenticated") return 401;
      return undefined;
    }, 90_000, "sandbox_same_browser_access_not_revoked");
    return { checkout: "paid", refund: "succeeded", same_browser_card_status: revoked };
  } finally { await browser.close(); }
});
