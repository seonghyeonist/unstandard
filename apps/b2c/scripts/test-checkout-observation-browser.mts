import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { observeCheckout, observePayControl, stripeFieldState } from "./checkout-observation.mts";

const origin = "https://checkout.example.test";
const marker = "never-serialize-private-fixture";
const browser = await chromium.launch({ executablePath: process.env.B2C_BROWSER });
try {
  const context = await browser.newContext();
  const diagnostics = observeCheckout(context, origin);
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === "/") {
      return route.fulfill({ contentType: "text/html", body:
        '<form onsubmit="event.preventDefault()"><button>Pay now</button></form><iframe src="https://js.stripe.com/card"></iframe><script>throw new TypeError("' + marker + '")</script>' });
    }
    if (url.origin === "https://js.stripe.com") {
      if (route.request().method() === "POST") return route.fulfill({ status: 204 });
      return route.fulfill({ contentType: "text/html", body: '<input required aria-label="Card" aria-invalid="true">' });
    }
    if (url.pathname.endsWith("/confirm")) return route.abort("aborted");
    return route.fulfill({ status: route.request().method() === "OPTIONS" ? 204 : 422, headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "next-action",
      "access-control-allow-methods": "POST",
    } });
  });
  const page = await context.newPage();
  await page.goto(origin);
  const field = page.frameLocator("iframe").getByRole("textbox", { name: "Card" });
  await field.fill("123");
  assert.equal(await stripeFieldState(field, "123"), "invalid");
  await field.evaluate((element) => element.removeAttribute("aria-invalid"));
  assert.equal(await stripeFieldState(field, "123"), "unverified");
  await field.evaluate((element) => element.setAttribute("aria-invalid", "false"));
  assert.equal(await stripeFieldState(field, "123"), "publicly_valid");
  assert.equal(await stripeFieldState(field, "1234"), "unverified");
  await field.clear();
  assert.equal(await stripeFieldState(field, "123"), "unverified");

  const pay = page.getByRole("button", { name: "Pay now" });
  const readPayEvents = await observePayControl(pay);
  diagnostics.beforeClick();
  await pay.click();
  assert.deepEqual(await readPayEvents(), {
    trusted_click: true, native_submit: true, document_trusted_click: true,
    replacement_control_click: false, original_control_detached: false,
  });
  const startup = JSON.stringify(diagnostics.snapshot());
  for (const expected of ["page_error", "frame_navigated"]) assert.ok(startup.includes(expected), expected);
  assert.ok(!startup.includes(marker));
  // Replacement before the locator acts, as can happen during a component re-render.
  await page.setContent('<form onsubmit="event.preventDefault()"><button>Pay now</button><button>Other</button></form>');
  const readReplacement = await observePayControl(pay);
  await pay.evaluate((node) => node.replaceWith(node.cloneNode(true)));
  await pay.click();
  assert.deepEqual(await readReplacement(), {
    trusted_click: true, native_submit: true, document_trusted_click: true,
    replacement_control_click: true, original_control_detached: true,
  });
  const readUnrelated = await observePayControl(pay);
  await page.getByRole("button", { name: "Other", exact: true }).click();
  assert.deepEqual(await readUnrelated(), {
    trusted_click: false, native_submit: false, document_trusted_click: true,
    replacement_control_click: false, original_control_detached: false,
  });
  // A real DOM click can trigger JavaScript without a native submit.
  await page.setContent('<button type="button" onclick="this.dataset.activated = 1">Pay now</button>');
  const readJsOnly = await observePayControl(pay);
  await pay.click();
  assert.equal(await pay.getAttribute("data-activated"), "1");
  assert.deepEqual(await readJsOnly(), {
    trusted_click: true, native_submit: false, document_trusted_click: true,
    replacement_control_click: false, original_control_detached: false,
  });
  const readNavigated = await observePayControl(pay);
  await page.goto(origin);
  assert.deepEqual(await readNavigated(), { trusted_click: "unverified", native_submit: "unverified" });

  const child = page.frameLocator("iframe").getByRole("textbox", { name: "Card" });
  await child.evaluate(async (node, secret) => {
    const childWindow = node.ownerDocument.defaultView!;
    await Promise.all(Array.from({ length: 50 }, () =>
      childWindow.fetch("/events?private=" + secret, { method: "POST", body: secret })));
  }, marker);
  await page.evaluate(async (marker) => {
    await fetch("https://sandbox.polar.sh/checkouts/" + marker + "/confirm", { method: "POST" }).catch(() => {});
    await fetch("/unrecognized?private=" + marker, { method: "POST" });
    await fetch("https://sandbox.polar.sh/checkout/" + marker + "?private=" + marker, {
      method: "POST", headers: { "next-action": marker }, body: marker,
    });
  }, marker);
  assert.equal(diagnostics.timeoutReason("pay_button_available", "open", "absent"), "sandbox_payment_confirmation_request_failed");
  const snapshot = diagnostics.snapshot();
  assert.ok(snapshot.omitted_provider_writes > 0);
  const main = snapshot.post_pay_main_polar_writes;
  const aborted = main.find((write) => write.error === "net::ERR_ABORTED");
  const action = main.find((write) => write.next_action && write.http === 422);
  assert.ok(aborted && action && aborted.request_id !== action.request_id);
  assert.equal(action.path_shape, "/checkout/[redacted]");
  assert.equal(action.frame, "main");
  assert.ok(action.duration_ms !== undefined);
  const output = JSON.stringify(snapshot);
  for (const expected of ["request_failed", "net::ERR_ABORTED", "422"]) {
    assert.ok(output.includes(expected), expected);
  }
  assert.ok(!output.includes(marker));
  console.log("PASS: Chromium startup, iframe validation, aborted requests, HTTP errors and log redaction");
} finally {
  await browser.close();
}
