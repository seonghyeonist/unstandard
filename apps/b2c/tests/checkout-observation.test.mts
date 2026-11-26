import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { BrowserContext } from "@playwright/test";
import { classifyCheckoutRequest, observeCheckout } from "../scripts/checkout-observation.mts";

const origin = "https://app.example.test";
const privateMarker = "sensitive-fixture-marker";

test("only emits classifications for trusted origin and recognized paths", () => {
  assert.deepEqual(
    classifyCheckoutRequest("POST", "https://sandbox.polar.sh/v1/checkouts/client/" + privateMarker + "/confirm?secret=" + privateMarker, origin),
    { host: "polar", method: "POST", route: "confirmation" },
  );
  assert.equal(classifyCheckoutRequest("POST", "https://api.stripe.com/v1/payment_methods", origin).route, "confirmation");
  assert.equal(classifyCheckoutRequest("PATCH", "https://sandbox.polar.sh/v1/checkouts/" + privateMarker, origin).route, "unclassified");
  assert.equal(classifyCheckoutRequest("POST", "https://sandbox.polar.sh.example.test/checkouts/id/confirm", origin).host, "other");
});

test("captures startup and submission failures without serializing browser data", () => {
  const context = new EventEmitter();
  const diagnostic = observeCheckout(context as unknown as BrowserContext, origin);
  const page = new EventEmitter();
  context.emit("page", page);
  page.emit("pageerror", new TypeError(privateMarker));
  page.emit("framenavigated", { url: () => "https://js.stripe.com/" + privateMarker, parentFrame: () => ({}) });
  diagnostic.beforeClick();

  const request = (path: string, errorText = "") => ({
    method: () => "POST",
    resourceType: () => "fetch",
    url: () => "https://sandbox.polar.sh/" + path + "?private=" + privateMarker,
    frame: () => { throw new Error(privateMarker); },
    failure: () => ({ errorText }),
  });
  const unclassified = request("checkout/" + privateMarker, privateMarker);
  assert.equal(diagnostic.timeoutReason("pay_button_available", "open", "absent"), "sandbox_payment_submission_not_observed");
  context.emit("request", unclassified);
  context.emit("requestfailed", unclassified);
  assert.equal(diagnostic.timeoutReason("pay_button_available", "open", "absent"), "sandbox_payment_submission_unclassified");

  const confirmation = request("checkouts/" + privateMarker + "/confirm", "net::ERR_ABORTED");
  context.emit("request", confirmation);
  assert.equal(diagnostic.timeoutReason("pay_button_available", "open", "absent"), "sandbox_provider_order_not_created");
  context.emit("requestfailed", confirmation);
  assert.equal(diagnostic.timeoutReason("pay_button_available", "open", "absent"), "sandbox_payment_confirmation_request_failed");

  const rejected = request("checkouts/" + privateMarker + "/confirm");
  context.emit("request", rejected);
  context.emit("response", { request: () => rejected, status: () => 422 });
  assert.equal(diagnostic.timeoutReason("pay_button_available", "open", "absent"), "sandbox_payment_confirmation_http_error");
  assert.equal(diagnostic.timeoutReason("invalid_form:postal_code", "open", "absent"), "sandbox_billing_validation_failed");
  assert.equal(diagnostic.timeoutReason("invalid_stripe_field", "open", "absent"), "sandbox_stripe_component_invalid");
  assert.equal(diagnostic.timeoutReason("pay_button_available", "confirmed", "unpaid"), "sandbox_provider_state_unresolved");

  const serialized = JSON.stringify(diagnostic.snapshot());
  for (const fragment of ["TypeError", "frame_navigated", "child", "net::ERR_ABORTED", "422", "unclassified"]) {
    assert.ok(serialized.includes(fragment));
  }
  assert.ok(!serialized.includes(privateMarker));
  for (let index = 0; index < 180; index++) page.emit("popup");
  assert.equal(diagnostic.snapshot().timeline.length, 160);
  assert.ok(diagnostic.snapshot().omitted > 0);
});
