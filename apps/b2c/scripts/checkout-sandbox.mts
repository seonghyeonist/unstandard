import { randomUUID } from "node:crypto";
import { chromium, type Page } from "@playwright/test";
import { createPolar } from "@polar-sh/sdk/2026-10";
import { and, eq } from "drizzle-orm";
import { connectDatabase, databaseTarget, type Database } from "../db/client.mts";
import { cards, members, orders, paymentEvents, rooms } from "../db/schema.mts";
import { loadPaymentConfig } from "../server/payment-config.mts";
import { cookieName } from "../server/session.mts";
import { hostedSandboxCheckout } from "../server/polar-provider.mts";
import { observeCheckout, observePayControl, stripeFieldState } from "./checkout-observation.mts";
import { allowWrites, Blocked, delay, required, summarize } from "./sandbox-helpers.mts";

function stage(name: string, status = "PASS", httpStatus?: number) {
  console.log(JSON.stringify({ layer: "polar_sandbox_checkout", status, stage: name, http_status: httpStatus }));
}

async function waitFor<T>(read: () => Promise<T | undefined>, timeout: number, reason: string | (() => string)) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const result = await read();
    if (result !== undefined) return result;
    await delay(2000);
  }
  throw new Blocked(typeof reason === "string" ? reason : reason());
}

async function checkoutScreen(page: Page, appOrigin: string, providerOrigin: string) {
  const origin = new URL(page.url()).origin;
  if (origin === appOrigin) return "returned_to_app";
  if (origin !== providerOrigin) return "provider_redirect";
  const checkout = page.getByRole("button", { name: "Pay now", exact: true });
  const alerts = page.getByRole("alert");
  const visibleError = await alerts.evaluateAll((elements) => elements.some((element) =>
    element.getClientRects().length > 0 && Boolean(element.textContent?.trim())));
  const invalidFields = await page.locator('input:invalid, select:invalid, [aria-invalid="true"]').evaluateAll((elements) => {
    const allowed = ["customer_email", "customer_name", "customer_billing_name", "customer_tax_id",
      "country", "line1", "line2", "postal_code", "city", "state"];
    return [...new Set(elements.filter((element) => element.getClientRects().length > 0).map((element) => {
      const name = element.getAttribute("name") ?? "";
      const field = name.split(".").at(-1) ?? "";
      if (allowed.includes(field)) return field;
      if (name.startsWith("custom_field_data.")) return "custom_field";
      if (element instanceof HTMLInputElement && element.type === "email") return "email_input";
      return "other";
    }))].sort();
  });
  if (invalidFields.length) return "invalid_form:" + invalidFields.join(",");
  if (visibleError) return "visible_alert";
  for (const frame of page.frames()) {
    if (new URL(frame.url() || "about:blank").origin !== "https://js.stripe.com") continue;
    const invalid = await frame.locator('input:invalid, [aria-invalid="true"]').evaluateAll((fields) =>
      fields.some((field) => field.getClientRects().length > 0));
    if (invalid) return "invalid_stripe_field";
    const challenge = await frame.getByText(/authenticate|verification code|3D Secure/i).first().isVisible();
    if (challenge) return "stripe_authentication_visible";
  }
  if (await checkout.isVisible()) return await checkout.isEnabled() ? "pay_button_available" : "pay_button_disabled";
  return "provider_screen_other";
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

async function enterCardField(page: Page, label: RegExp, digits: string, code: string) {
  const field = await cardField(page, label);
  await field.pressSequentially(digits, { delay: 55 });
  if ((await field.inputValue()).replace(/\D/g, "") !== digits) throw new Blocked(code);
  return field;
}

async function verifyLedger(db: Database, orderId: string, checkoutId: string, state: "paid" | "refunded") {
  const eventType = state === "paid" ? "transaction.completed" : "adjustment.updated";
  const [entry] = await db.select({ state: orders.state, revokedAt: rooms.revokedAt })
    .from(orders).innerJoin(rooms, eq(rooms.orderId, orders.id))
    .innerJoin(paymentEvents, and(eq(paymentEvents.orderId, orders.id),
      eq(paymentEvents.providerTx, checkoutId), eq(paymentEvents.type, eventType)))
    .where(and(eq(orders.id, orderId), eq(orders.providerTx, checkoutId), eq(orders.paymentMode, "sandbox"))).limit(1);
  if (!entry || entry.state !== state || Boolean(entry.revokedAt) !== (state === "refunded")) {
    throw new Error("sandbox_signed_webhook_ledger_mismatch");
  }
  stage(state === "paid" ? "signed_paid_webhook_ledger" : "signed_refund_webhook_ledger");
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
  const verifyLocalLedger = process.env.B2C_E2E_VERIFY_LOCAL_LEDGER === "1";
  if (verifyLocalLedger && !databaseTarget().local) throw new Error("sandbox_ledger_probe_requires_local_database");
  const browser = await chromium.launch({
    executablePath: process.env.B2C_BROWSER,
    headless: process.env.B2C_BROWSER_HEADED !== "1",
  })
    .catch(() => { throw new Blocked("sandbox_browser_launch_failed"); });
  stage("browser_launched");
  const ledger = verifyLocalLedger ? connectDatabase() : undefined;
  let diagnostics: ReturnType<typeof observeCheckout> | undefined;
  try {
    const context = await browser.newContext({ locale: "en-US",
      httpCredentials: accessKey ? { username: "b2c", password: accessKey, origin } : undefined });
    const observation = observeCheckout(context, origin);
    diagnostics = observation;
    const page = await context.newPage();
    const pageReply = await page.goto(origin + "/checkout", { timeout: 15_000 })
      .catch(() => { throw new Blocked("sandbox_checkout_page_not_reachable"); });
    stage("app_checkout_page", pageReply?.status() === 200 ? "PASS" : "FAIL", pageReply?.status());
    if (pageReply?.status() !== 200) throw new Blocked("sandbox_checkout_page_access_not_verified");
    const before = await context.request.get(origin + "/api/b2c/me/card");
    stage("unpaid_card_api", before.status() === 401 ? "PASS" : "FAIL", before.status());
    if (before.status() !== 401) throw new Error("unpaid_card_access_expected_401");
    const orderPath = origin + "/api/b2c/orders";
    let order: { status: number; orderId?: string; transactionId?: string; checkoutUrl?: string } | undefined;
    await page.route(orderPath, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      // Read from the proxied API response before the app leaves this document.
      const response = await route.fetch({ maxRedirects: 0 });
      const status = response.status();
      const data = status === 201 ? await response.json() as { orderId?: string; transactionId?: string; checkoutUrl?: string } : {};
      order = { status, ...data };
      await route.fulfill({ response });
    }, { times: 1 });
    await page.getByRole("button", { name: "Open Sandbox checkout" }).click({ timeout: 10_000 });
    const result = await waitFor(async () => order, 20_000, "sandbox_app_order_response_not_captured");
    stage("app_create_checkout", result.status === 201 ? "PASS" : "FAIL", result.status);
    if (result.status !== 201) throw new Error("sandbox_order_create_failed");
    if (!result.checkoutUrl || !result.transactionId || !result.orderId) {
      throw new Error("sandbox_order_missing_hosted_checkout");
    }
    const { transactionId, orderId } = result;
    let destination: URL;
    try {
      destination = new URL(hostedSandboxCheckout(result.checkoutUrl));
    } catch {
      throw new Error("sandbox_order_returned_unrecognized_checkout_url");
    }
    await page.waitForURL((url) => url.origin === destination.origin && url.pathname === destination.pathname,
      { timeout: 20_000 }).catch(() => { throw new Blocked("sandbox_hosted_checkout_not_reached"); });
    const providerCheckout = await provider.client.checkouts.get(transactionId);
    if (providerCheckout.id !== transactionId || providerCheckout.organization_id !== organizationId ||
        providerCheckout.product_id !== required("B2C_POLAR_PRODUCT_ID") ||
        providerCheckout.metadata.b2c_order_id !== orderId || providerCheckout.status !== "open") {
      throw new Error("sandbox_checkout_mapping_mismatch");
    }
    stage("polar_checkout_opened");
    // Polar can require a full US address even when checkout creation requests country only.
    // Seed the synthetic purchaser details for this checkout, then use the hosted form for the card.
    // Polar validates DNS deliverability. Gmail has MX records, but cannot assign hyphenated usernames.
    const email = `p2-smoke-${randomUUID()}@gmail.com`;
    const billing = await provider.client.checkouts.update(transactionId, {
      customer_email: email, customer_name: "Sandbox Buyer",
      customer_billing_address: {
        country: "US", line1: "476 5th Avenue", postal_code: "10018", city: "New York", state: "NY",
      },
    }).catch((error: unknown) => {
      const httpStatus = error instanceof Error && "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode : undefined;
      stage("sandbox_checkout_prefill", "FAIL", httpStatus);
      throw new Blocked("sandbox_checkout_prefill_rejected");
    });
    if (billing.id !== transactionId || billing.status !== "open" ||
        billing.customer_billing_address?.country !== "US" || !billing.customer_billing_address.postal_code ||
        billing.customer_email !== email || billing.customer_name !== "Sandbox Buyer") {
      throw new Error("sandbox_billing_fixture_not_applied");
    }
    stage("sandbox_billing_fixture_applied");
    await page.reload({ timeout: 20_000 }).catch(() => {
      throw new Blocked("sandbox_hosted_checkout_reload_failed");
    });
    if (await page.getByRole("textbox", { name: "Email", exact: true }).inputValue() !== email ||
        await page.getByRole("textbox", { name: "Cardholder name" }).inputValue() !== "Sandbox Buyer") {
      throw new Blocked("sandbox_checkout_prefill_not_rendered");
    }
    const cardNumber = await enterCardField(page, /Card number/i, "4242424242424242", "sandbox_test_card_number_not_entered");
    const year = String(new Date().getUTCFullYear() + 3).slice(-2);
    const expiry = await enterCardField(page, /Expir/i, "12" + year, "sandbox_test_card_expiry_not_entered");
    const cvc = await enterCardField(page, /Security code|CVC/i, "123", "sandbox_test_card_security_code_not_entered");
    await cvc.press("Tab");
    stage("sandbox_browser_card_input_values_observed");
    const beforeSubmit = await checkoutScreen(page, origin, destination.origin);
    console.log(JSON.stringify({ layer: "polar_sandbox_checkout", stage: "checkout_before_submit", screen: beforeSubmit }));
    const stripeFields = {
      number: await stripeFieldState(cardNumber),
      expiry: await stripeFieldState(expiry),
      security_code: await stripeFieldState(cvc),
    };
    observation.record("form_state", { screen: beforeSubmit, stripe_fields: stripeFields });
    if (beforeSubmit !== "pay_button_available") throw new Blocked("sandbox_checkout_form_not_ready");
    if (Object.values(stripeFields).some((state) => state === "invalid")) {
      throw new Blocked("sandbox_stripe_component_invalid");
    }
    if (Object.values(stripeFields).some((state) => state === "unverified")) {
      throw new Blocked("sandbox_stripe_component_completion_unverified");
    }
    const payButton = page.getByRole("button", { name: "Pay now", exact: true });
    const readPayEvents = await observePayControl(payButton).catch(() => {
      throw new Blocked("sandbox_pay_control_observation_unavailable");
    });
    observation.beforeClick();
    try {
      await payButton.click({ timeout: 15_000 });
    } catch {
      throw new Blocked("sandbox_checkout_control_unavailable");
    } finally {
      observation.record("pay_control_events", await readPayEvents());
    }
    observation.record("pay_click_completed");
    stage("test_pay_button_clicked");
    let previousObservation: string | undefined;
    let lastScreen = beforeSubmit;
    let lastCheckout = "unobserved";
    let lastOrder = "unobserved";
    const paid = await waitFor(async () => {
      const [checkout, orders] = await Promise.all([
        provider.client.checkouts.get(transactionId),
        provider.client.orders.list({ organization_id: organizationId, checkout_id: transactionId, limit: 2 }),
      ]);
      if (orders.items.length > 1) throw new Error("duplicate_sandbox_order");
      const [order] = orders.items;
      const screen = await checkoutScreen(page, origin, destination.origin).catch(() => "screen_unavailable");
      lastScreen = screen;
      lastCheckout = checkout.status;
      lastOrder = order ? (order.paid ? "paid" : "unpaid") : "absent";
      const providerState = { checkout_status: lastCheckout, order_state: lastOrder, screen };
      const serialized = JSON.stringify(providerState);
      if (serialized !== previousObservation) {
        observation.record("provider_state", providerState);
        console.log(JSON.stringify({ layer: "polar_sandbox_checkout", stage: "provider_checkout_observed",
          observed: providerState }));
        previousObservation = serialized;
      }
      return order?.paid ? order : undefined;
    }, 90_000, () => observation.timeoutReason(lastScreen, lastCheckout, lastOrder));
    if (paid.checkout_id !== transactionId || paid.metadata.b2c_order_id !== providerCheckout.metadata.b2c_order_id ||
        paid.product_id !== providerCheckout.product_id || (paid.units ?? 1) !== 1 ||
        paid.currency.toUpperCase() !== "USD" || paid.subtotal_amount !== 899 || paid.discount_amount !== 0 ||
        paid.net_amount !== 899 || paid.total_amount !== paid.net_amount + paid.tax_amount) {
      throw new Error("sandbox_order_contract_mismatch");
    }
    console.log(JSON.stringify({ layer: "polar_sandbox_checkout", status: "PASS", stage: "provider_order_paid",
      principal_cents: paid.net_amount, tax_cents: paid.tax_amount, total_cents: paid.total_amount }));
    const grantedStatus = await waitFor(async () => {
      if (new URL(page.url()).origin !== origin) return undefined;
      const card = await context.request.get(origin + "/api/b2c/me/card");
      return card.status() === 202 || card.status() === 200 ? card.status() : undefined;
    }, 90_000, "sandbox_signed_webhook_or_claim_not_confirmed");
    const buyerSession = (await context.cookies(origin)).find((cookie) => cookie.name === cookieName)?.value;
    if (!buyerSession) throw new Error("sandbox_buyer_session_cookie_missing");
    stage("same_browser_access_granted", "PASS", grantedStatus);
    if (ledger) await verifyLedger(ledger.db, orderId, transactionId, "paid");
    let cardResult: "generated" | "fixture" | "pending" | "fixture_failed" =
      grantedStatus === 200 ? "generated" : "pending";
    if (ledger && grantedStatus === 202) {
      // P3 generates cards. Seed only the card on this disposable database after real paid evidence.
      try {
        const [buyer] = await ledger.db.select({ roomId: rooms.id, ownerMemberId: members.id })
          .from(rooms).innerJoin(members, eq(members.roomId, rooms.id))
          .where(and(eq(rooms.orderId, orderId), eq(members.role, "buyer"))).limit(1);
        if (!buyer) throw new Error("fixture_buyer_missing");
        const payload = { text: "Synthetic P2 card for access testing." };
        await ledger.db.insert(cards).values({ ...buyer, kind: "personal", revision: 0, payload });
        const reply = await context.request.get(origin + "/api/b2c/me/card");
        if (reply.status() !== 200 || (await reply.json()).payload?.text !== payload.text) {
          throw new Error("fixture_card_not_returned");
        }
        cardResult = "fixture";
        stage("same_browser_fixture_card_read", "PASS", 200);
      } catch {
        cardResult = "fixture_failed";
        stage("same_browser_fixture_card_read", "FAIL");
      }
    }
    if (cardResult === "fixture_failed" || cardResult === "pending") {
      throw new Blocked("sandbox_card_read_requires_reconciliation_before_refund");
    }
    const existingRefunds = await provider.client.refunds.list({ order_id: paid.id, limit: 1 });
    if (existingRefunds.items.length !== 0) throw new Blocked("sandbox_order_already_has_refund");
    const refund = await refundClient.refunds.create({
      order_id: paid.id, amount: paid.net_amount, reason: "customer_request", revoke_benefits: true,
    });
    await waitFor(async () => {
      const { items } = await provider.client.refunds.list({ id: refund.id, order_id: paid.id, succeeded: true });
      return items.some((item) => item.id === refund.id && item.status === "succeeded" &&
        item.amount === paid.net_amount && item.tax_amount === paid.tax_amount) ? true : undefined;
    }, 180_000, "sandbox_full_refund_not_confirmed");
    console.log(JSON.stringify({ layer: "polar_sandbox_checkout", status: "PASS", stage: "full_refund_succeeded" }));
    const revoked = await waitFor(async () => {
      const reply = await context.request.get(origin + "/api/b2c/me/card");
      const session = (await context.cookies(origin)).find((cookie) => cookie.name === cookieName)?.value;
      if (session !== buyerSession) throw new Error("sandbox_buyer_session_changed");
      if (reply.status() === 410) return 410;
      if (reply.status() === 401 && !reply.headers()["www-authenticate"] && (await reply.json()).error === "unauthenticated") {
        return 401;
      }
      return undefined;
    }, 90_000, "sandbox_same_browser_access_not_revoked");
    if (ledger) await verifyLedger(ledger.db, orderId, transactionId, "refunded");
    stage("same_browser_access_revoked", "PASS", revoked);
    return { checkout: "paid", refund: "succeeded", card_read: cardResult, same_browser_card_status: revoked };
  } finally {
    if (diagnostics) console.log(JSON.stringify({ layer: "polar_sandbox_checkout", stage: "browser_diagnostics",
      ...diagnostics.snapshot() }));
    try { await browser.close(); } finally { await ledger?.pool.end(); }
  }
});
