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
    headers: () => ({ "next-action": privateMarker, authorization: privateMarker }),
    frame: () => { throw new Error(privateMarker); },
    failure: () => ({ errorText }),
  });
  const telemetry = request("ingest/" + privateMarker, "net::ERR_ABORTED");
  context.emit("request", telemetry);
  context.emit("requestfailed", telemetry);
  assert.equal(diagnostic.snapshot().post_pay_provider_writes[0].route, "telemetry");
  assert.equal(diagnostic.timeoutReason("pay_button_available", "open", "absent"), "sandbox_payment_submission_not_observed");

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
  const writes = diagnostic.snapshot().post_pay_provider_writes;
  assert.deepEqual(writes.map(({ request_id, path_shape, next_action, http, error }) =>
    ({ request_id, path_shape, next_action, http, error })), [
    { request_id: 1, path_shape: "/ingest/[redacted]", next_action: true, http: undefined, error: "net::ERR_ABORTED" },
    { request_id: 2, path_shape: "/checkout/[redacted]", next_action: true, http: undefined, error: "other" },
    { request_id: 3, path_shape: "/checkouts/[redacted]/confirm", next_action: true, http: undefined, error: "net::ERR_ABORTED" },
    { request_id: 4, path_shape: "/checkouts/[redacted]/confirm", next_action: true, http: 422, error: undefined },
  ]);
  assert.ok(!JSON.stringify(diagnostic.snapshot()).includes(privateMarker));
});

test("retains main-frame Polar request and outcome after child-frame traffic fills the general buffer", () => {
  const context = new EventEmitter();
  const diagnostic = observeCheckout(context as unknown as BrowserContext, origin);
  diagnostic.beforeClick();
  const request = (host: string, child: boolean) => ({
    method: () => "POST",
    resourceType: () => "fetch",
    url: () => "https://" + host + "/checkout/" + privateMarker + "?private=" + privateMarker,
    headers: () => ({ "next-action": privateMarker }),
    frame: () => ({ parentFrame: () => child ? {} : null }),
    failure: () => ({ errorText: "net::ERR_ABORTED" }),
  });
  for (let i = 0; i < 50; i++) context.emit("request", request("js.stripe.com", true));
  const main = request("sandbox.polar.sh", false);
  context.emit("request", main);
  context.emit("requestfailed", main);
  const snapshot = diagnostic.snapshot();
  assert.equal(snapshot.post_pay_provider_writes.length, 40);
  assert.equal(snapshot.omitted_provider_writes, 11);
  assert.equal(snapshot.omitted_main_polar_writes, 0);
  assert.equal(snapshot.post_pay_main_polar_writes.length, 1);
  assert.equal(snapshot.post_pay_main_polar_writes[0].request_id, 51);
  assert.equal(snapshot.post_pay_main_polar_writes[0].error, "net::ERR_ABORTED");
  assert.equal(snapshot.post_pay_main_polar_writes[0].path_shape, "/checkout/[redacted]");
  assert.ok(!JSON.stringify(snapshot).includes(privateMarker));
});

test("preserves post-pay navigation and unexpected closure after telemetry saturation", () => {
  const context = new EventEmitter();
  const page = new EventEmitter();
  const diagnostic = observeCheckout(context as unknown as BrowserContext, origin);
  context.emit("page", page);
  diagnostic.beforeClick();
  const frame = { url: () => "https://sandbox.polar.sh/" + privateMarker, parentFrame: () => null };
  page.emit("framenavigated", frame);
  page.emit("framedetached", frame);
  page.emit("crash");
  page.emit("close");
  context.emit("close");
  for (let i = 0; i < 200; i++) page.emit("pageerror", new TypeError(privateMarker));
  const snapshot = diagnostic.snapshot();
  assert.ok(snapshot.omitted > 0);
  assert.equal(snapshot.omitted_post_pay_lifecycle, 0);
  assert.deepEqual(snapshot.post_pay_lifecycle.map((entry) => (entry as { event: string }).event), [
    "pay_click_started", "frame_navigated", "frame_detached", "page_crashed", "page_closed", "context_closed",
  ]);
  assert.ok(!JSON.stringify(snapshot).includes(privateMarker));
});

test("compares pre-pay writes that finish after Pay without treating them as submissions", () => {
  const context = new EventEmitter();
  const diagnostic = observeCheckout(context as unknown as BrowserContext, origin);
  const request = () => ({
    method: () => "POST", resourceType: () => "fetch",
    url: () => "https://sandbox.polar.sh/checkout/" + privateMarker,
    headers: () => ({ "next-action": privateMarker }),
    frame: () => ({ parentFrame: () => null }),
    failure: () => ({ errorText: "net::ERR_ABORTED" }),
  });
  for (let i = 0; i < 45; i++) context.emit("request", request());
  const before = request();
  context.emit("request", before);
  diagnostic.beforeClick();
  context.emit("requestfailed", before);
  assert.equal(diagnostic.timeoutReason("pay_button_available", "open", "absent"),
    "sandbox_payment_submission_not_observed");
  const after = request();
  context.emit("request", after);
  context.emit("requestfailed", after);
  const snapshot = diagnostic.snapshot();
  assert.equal(snapshot.pre_pay_main_polar_writes.length, 40);
  assert.equal(snapshot.omitted_pre_pay_main_polar_writes, 6);
  const earlier = snapshot.pre_pay_main_polar_writes.at(-1)!;
  const later = snapshot.post_pay_main_polar_writes[0];
  assert.equal(earlier.after_pay, false);
  assert.equal(later.after_pay, true);
  assert.equal(earlier.error, "net::ERR_ABORTED");
  assert.equal(earlier.path_shape, later.path_shape);
  assert.equal(earlier.request_id + 1, later.request_id);
  assert.ok(!JSON.stringify(snapshot).includes(privateMarker));
});
