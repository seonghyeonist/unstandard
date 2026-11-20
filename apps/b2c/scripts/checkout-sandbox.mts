import { randomUUID } from "node:crypto";
import { chromium, type Locator, type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { connectDatabase, databaseTarget } from "../db/client.mts";
import { jobs, members, orders, paymentEvents, rooms, sessions } from "../db/schema.mts";
import { loadPaymentConfig } from "../server/payment-config.mts";
import { validPayment } from "../server/payment-provider.mts";
import { allowWrites, Blocked, delay, paddleApi, required, sandboxOrigin, summarize } from "./paddle-api.mts";

async function waitFor<T>(run: () => Promise<T | undefined>, milliseconds: number, interval: number, reason: string) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    const result = await run();
    if (result !== undefined) return result;
    await delay(interval);
  }
  throw new Blocked(reason);
}

async function field(page: Page, name: RegExp, selectors: string, seconds = 15) {
  return waitFor(async () => {
    for (const frame of page.frames()) {
      const host = new URL(frame.url() || "about:blank").hostname;
      if (!host.endsWith(".paddle.com") || !host.includes("sandbox")) continue;
      const locator = frame.getByRole("textbox", { name }).or(frame.locator(selectors)).first();
      if (await locator.isVisible()) return locator;
    }
    return undefined;
  }, seconds * 1_000, 300, "sandbox_checkout_fields_unavailable");
}

async function button(page: Page, name: RegExp, timeout = 12_000) {
  return waitFor(async () => {
    for (const frame of page.frames()) {
      const host = new URL(frame.url() || "about:blank").hostname;
      if (!host.endsWith(".paddle.com") || !host.includes("sandbox")) continue;
      const locator = frame.getByRole("button", { name }).first();
      if (await locator.isVisible() && await locator.isEnabled()) return locator;
    }
    return undefined;
  }, timeout, 250, "sandbox_checkout_control_or_button_unavailable");
}

async function fill(locator: Locator, value: string) { await locator.fill(value, { timeout: 4_000 }); }
function proof(stage: string) { console.log(JSON.stringify({ layer: "real_sandbox_checkout", stage, status: "PASS" })); }

await summarize("real_sandbox_checkout", async () => {
  allowWrites("checkout-b2c-sandbox");
  const origin = sandboxOrigin();
  const domain = required("B2C_SANDBOX_TEST_EMAIL_DOMAIN");
  if (!(domain === "example.test" || /^[a-z0-9]+(?:[.-][a-z0-9]+)*\.test$/i.test(domain))) {
    throw new Error("synthetic_test_email_domain_required");
  }
  const accessKey = required("B2C_SANDBOX_ACCESS_KEY");
  if (!/^[a-f0-9]{64}$/i.test(accessKey)) throw new Error("invalid_sandbox_access_key");
  const config = loadPaymentConfig();
  const api = paddleApi("B2C_PADDLE_E2E_API_KEY");
  required("B2C_DATABASE_URL");
  if (databaseTarget().local) throw new Blocked("isolated_remote_b2c_db_required");
  const { db, pool } = connectDatabase();
  try {
    await config.provider.validateCatalog();
    const anonymous = await fetch(origin + "/checkout", { redirect: "error", signal: AbortSignal.timeout(12_000) });
    if (anonymous.status !== 401) throw new Error("sandbox_checkout_operator_gate_missing");
    const publicCheckout = await fetch(origin + "/checkout", {
      headers: { Authorization: "Basic " + Buffer.from("b2c:" + accessKey).toString("base64") },
      redirect: "error", signal: AbortSignal.timeout(12_000),
    });
    if (publicCheckout.status === 401 || publicCheckout.status === 403) throw new Blocked("b2c_checkout_access_protected");
    if (!publicCheckout.ok || !(await publicCheckout.text()).includes("UNSTANDARD Sandbox")) {
      throw new Error("sandbox_checkout_page_unavailable");
    }
    const browser = await chromium.launch({ executablePath: process.env.B2C_BROWSER });
    try {
      const context = await browser.newContext({
        locale: "en-US", httpCredentials: { username: "b2c", password: accessKey, origin, send: "always" },
      });
      const page = await context.newPage();
      await page.goto(origin + "/checkout", { waitUntil: "domcontentloaded", timeout: 20_000 });
      const pre = await context.request.get(origin + "/api/b2c/me/card");
      if (pre.status() !== 401) throw new Error("unpaid_card_access_expected_401");
      const response = page.waitForResponse((reply) =>
        reply.url() === origin + "/api/b2c/orders" && reply.request().method() === "POST", { timeout: 20_000 });
      await page.getByRole("button", { name: "Open Sandbox checkout" }).click({ timeout: 15_000 });
      const created = await response;
      if (created.status() !== 201) throw new Error("sandbox_order_creation_failed");
      const { orderId, transactionId } = await created.json() as { orderId: string; transactionId: string };
      const claimBefore = await context.request.post(origin + "/api/b2c/orders/claim",
        { data: { orderId }, headers: { Origin: origin } });
      if (claimBefore.status() !== 202) throw new Error("unconfirmed_order_expected_202");
      proof("unpaid_access_blocked_and_transaction_created");

      const email = `b2c-p2-${randomUUID()}@${domain}`;
      await fill(await field(page, /email/i, 'input[type="email"]'), email);
      const postal = await field(page, /zip|postal/i, 'input[autocomplete="postal-code"]', 3).catch(() => null);
      if (postal) await fill(postal, "10001");
      const next = await button(page, /^(continue|next)$/i, 3_000).catch(() => null);
      if (next) await next.click({ timeout: 4_000 });
      try {
        await fill(await field(page, /card number/i, 'input[autocomplete="cc-number"]'), "4242424242424242");
        const year = String(new Date().getUTCFullYear() + 2).slice(-2);
        await fill(await field(page, /expir/i, 'input[autocomplete="cc-exp"]'), `12/${year}`);
        await fill(await field(page, /cvc|cvv|security code/i, 'input[autocomplete="cc-csc"]'), "123");
        const name = await field(page, /cardholder|name on card/i, 'input[autocomplete="cc-name"]', 3).catch(() => null);
        if (name) await fill(name, "Sandbox Buyer");
        await (await button(page, /^(pay\b|complete purchase)/i)).click({ timeout: 5_000 });
      } catch {
        throw new Blocked("checkout_form_or_security_control_requires_review");
      }
      try {
        await page.getByRole("status").getByText(/checking payment with the server|payment confirmed/i)
          .waitFor({ timeout: 45_000 });
      } catch {
        throw new Blocked("sandbox_checkout_completion_or_security_control_pending");
      }
      proof("checkout_completion_callback_observed");

      const room = await waitFor(async () => {
        const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
        const [grant] = await db.select().from(rooms).where(eq(rooms.orderId, orderId));
        const ledger = await db.select().from(paymentEvents).where(and(eq(paymentEvents.orderId, orderId),
          eq(paymentEvents.type, "transaction.completed")));
        return order?.state === "paid" && order.providerTx === transactionId && grant && ledger.length === 1 ? grant : undefined;
      }, 80_000, 2_000, "signed_platform_completion_pending");
      const verified = await config.provider.getTransaction(transactionId);
      if (verified.status !== "completed" || !validPayment(verified, orderId, config.provider.priceId)) {
        throw new Error("paddle_transaction_readback_mismatch");
      }
      const personal = await db.select().from(jobs).where(and(eq(jobs.orderId, orderId), eq(jobs.kind, "personal_card")));
      const [buyer] = await db.select().from(members).where(and(eq(members.roomId, room.id), eq(members.role, "buyer")));
      if (personal.length !== 1 || !buyer) throw new Error("entitlement_or_job_mismatch");
      if ((await context.request.get(origin + "/api/b2c/me/card")).status() === 401) {
        await context.request.post(origin + "/api/b2c/orders/claim", {
          data: { orderId }, headers: { Origin: origin },
        });
      }
      await waitFor(async () => {
        const reply = await context.request.get(origin + "/api/b2c/me/card");
        return reply.status() === 202 && reply.headers()["cache-control"] === "no-store" ? true : undefined;
      }, 35_000, 2_000, "buyer_session_pending");
      if ((await db.select().from(sessions).where(eq(sessions.memberId, buyer.id))).length !== 1) {
        throw new Error("buyer_session_count_mismatch");
      }
      proof("platform_webhook_provider_readback_and_protected_card_api");

      // The E2E key's adjustment capability is used only for the synthetic order created by this run.
      const existing = (await config.provider.getAdjustments(transactionId)).find((item) =>
        item.action === "refund" && item.type === "full" && ["approved", "pending_approval"].includes(item.status));
      if (!existing) await api.one("/adjustments", "POST", {
        action: "refund", type: "full", transaction_id: transactionId, reason: "UNSTANDARD B2C synthetic Sandbox E2E",
      });
      await waitFor(async () => {
        const result = await config.provider.getAdjustments(transactionId);
        if (result.some((item) => item.action === "refund" && item.type === "full" && item.status === "rejected")) {
          throw new Error("sandbox_refund_rejected");
        }
        return result.some((item) => item.action === "refund" && item.type === "full" && item.status === "approved") ? true : undefined;
      }, 12 * 60_000, 15_000, "sandbox_refund_approval_pending");
      await waitFor(async () => {
        const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
        const ledger = await db.select().from(paymentEvents).where(eq(paymentEvents.orderId, orderId));
        const card = await context.request.get(origin + "/api/b2c/me/card");
        return order?.state === "refunded" && ledger.some((event) => event.type.startsWith("adjustment.")) &&
          [401, 410].includes(card.status()) ? true : undefined;
      }, 70_000, 2_000, "sandbox_refund_revocation_pending");
      return { signedWebhook: true, providerReadback: true, cardApi: 202, refundApproved: true, revoked: true };
    } finally {
      await browser.close();
    }
  } finally {
    await pool.end();
  }
});
