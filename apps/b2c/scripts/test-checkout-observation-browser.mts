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
      return route.fulfill({ contentType: "text/html", body: '<input required aria-label="Card" aria-invalid="true">' });
    }
    if (url.pathname.endsWith("/confirm")) return route.abort("aborted");
    return route.fulfill({ status: 422 });
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
  assert.deepEqual(await readPayEvents(), { trusted_click: true, native_submit: true });
  await page.evaluate(async (marker) => {
    await fetch("https://sandbox.polar.sh/checkouts/" + marker + "/confirm", { method: "POST" }).catch(() => {});
    await fetch("/unrecognized?private=" + marker, { method: "POST" });
  }, marker);
  assert.equal(diagnostics.timeoutReason("pay_button_available", "open", "absent"), "sandbox_payment_confirmation_request_failed");
  const output = JSON.stringify(diagnostics.snapshot());
  for (const expected of ["page_error", "frame_navigated", "request_failed", "net::ERR_ABORTED", "422"]) {
    assert.ok(output.includes(expected), expected);
  }
  assert.ok(!output.includes(marker));
  console.log("PASS: Chromium startup, iframe validation, aborted requests, HTTP errors and log redaction");
} finally {
  await browser.close();
}
