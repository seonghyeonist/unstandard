import type { BrowserContext, Frame, Locator, Request } from "@playwright/test";

const browserErrors = new Set([
  "net::ERR_ABORTED", "net::ERR_CONNECTION_RESET", "net::ERR_CONNECTION_REFUSED",
  "net::ERR_NAME_NOT_RESOLVED", "net::ERR_TIMED_OUT", "net::ERR_NETWORK_CHANGED",
  "net::ERR_BLOCKED_BY_CLIENT", "net::ERR_CERT_AUTHORITY_INVALID",
]);
const methods = new Set(["GET", "POST", "PATCH", "PUT", "OPTIONS", "DELETE"]);
const resourceTypes = new Set(["document", "script", "fetch", "xhr", "stylesheet", "image", "font"]);
const scriptErrors = new Set(["TypeError", "ReferenceError", "SyntaxError", "RangeError", "SecurityError"]);

function service(url: string, appOrigin: string) {
  const parsed = URL.parse(url);
  if (parsed?.origin === appOrigin) return "app";
  if (parsed?.protocol !== "https:") return "other";
  const host = parsed.hostname;
  if (host === "stripe.com" || host.endsWith(".stripe.com")) return "stripe";
  if (host === "polar.sh" || host.endsWith(".polar.sh")) return "polar";
  return "other";
}

export function classifyCheckoutRequest(method: string, url: string, appOrigin: string) {
  const host = service(url, appOrigin);
  const path = URL.parse(url)?.pathname ?? "";
  let route = "unclassified";
  if (host === "stripe" && URL.parse(url)?.hostname === "api.stripe.com" && method === "POST" &&
      /^\/v1\/(?:confirmation_tokens|payment_methods|(?:payment_intents|setup_intents)\/[^/]+\/confirm)\/?$/.test(path)) {
    route = "confirmation";
  }
  if (host === "polar" && method === "POST" && /\/checkouts\/(?:client\/)?[^/]+\/confirm\/?$/.test(path)) {
    route = "confirmation";
  }
  return { host, route, method: methods.has(method) ? method : "other" };
}

export async function stripeFieldState(field: Locator) {
  return field.evaluate((element) => {
    if (!(element instanceof HTMLInputElement) || !element.value) return "unverified";
    const invalid = element.getAttribute("aria-invalid");
    if (invalid === "true" || !element.validity.valid) return "invalid";
    // Native validity alone can be true even when the provider has not validated the field.
    return invalid === "false" ? "publicly_valid" : "unverified";
  }, undefined, { timeout: 2_000 }).catch(() => "unverified" as const);
}

export async function observePayControl(button: Locator) {
  const state = await button.evaluateHandle((control) => {
    const observed = { trusted_click: false, native_submit: false };
    control.addEventListener("click", (event) => { observed.trusted_click ||= event.isTrusted; },
      { capture: true, once: true });
    control.closest("form")?.addEventListener("submit", () => { observed.native_submit = true; },
      { capture: true, once: true });
    return observed;
  }, undefined, { timeout: 2_000 });
  return async () => {
    try {
      return await state.evaluate((value) => ({ ...value }));
    } catch {
      // The provider may navigate before the DOM observation can be read.
      return { trusted_click: "unverified", native_submit: "unverified" } as const;
    } finally {
      await state.dispose().catch(() => {});
    }
  };
}

export function observeCheckout(context: BrowserContext, appOrigin: string) {
  const started = performance.now();
  type Metadata = ReturnType<typeof classifyCheckoutRequest> & { resource: string; frame: string; after_pay: boolean };
  type Outcome = { http?: number; error?: string; duration_ms?: number };
  const active = new WeakMap<Request, { metadata: Metadata; startedAt: number }>();
  const timeline: object[] = [];
  let omitted = 0;
  let afterPay = false;
  let confirmationRequested = false;
  let confirmationHttpError = false;
  let confirmationFailed = false;
  let unknownProviderWrite = false;

  function record(event: string, data: object = {}) {
    const entry = { event, ms: Math.round(performance.now() - started), ...data };
    if (timeline.length >= 160) {
      timeline.shift();
      omitted++;
    }
    timeline.push(entry);
  }

  context.on("request", (request) => {
    const classification = classifyCheckoutRequest(request.method(), request.url(), appOrigin);
    let frame = "unavailable";
    try {
      frame = request.frame().parentFrame() ? "child" : "main";
    } catch {
      // Service-worker requests and early navigation can lack an associated frame.
    }
    const type = request.resourceType();
    const metadata = { ...classification, resource: resourceTypes.has(type) ? type : "other", frame, after_pay: afterPay };
    active.set(request, { metadata, startedAt: performance.now() });
    if (afterPay) {
      confirmationRequested ||= metadata.route === "confirmation";
      unknownProviderWrite ||= ["polar", "stripe"].includes(metadata.host) &&
        metadata.route === "unclassified" && ["POST", "PATCH", "PUT"].includes(metadata.method);
    }
    record("request", metadata);
  });

  function outcome(event: string, request: Request, data: Outcome = {}) {
    const tracked = active.get(request);
    if (!tracked) return;
    const { metadata, startedAt } = tracked;
    if (metadata.after_pay && metadata.route === "confirmation") {
      confirmationHttpError ||= (data.http ?? 0) >= 400;
      confirmationFailed ||= Boolean(data.error);
    }
    record(event, { ...metadata, ...data, duration_ms: Math.round(performance.now() - startedAt) });
  }

  context.on("response", (reply) => outcome("response", reply.request(), { http: reply.status() }));
  context.on("requestfinished", (request) => outcome("request_finished", request));
  context.on("requestfailed", (request) => {
    const code = request.failure()?.errorText ?? "";
    outcome("request_failed", request, { error: browserErrors.has(code) ? code : "other" });
  });
  context.on("page", (page) => {
    record("page_created");
    page.on("popup", () => record("popup"));
    page.on("pageerror", (error) => record("page_error", { kind: scriptErrors.has(error.name) ? error.name : "other" }));
    page.on("console", (message) => {
      if (message.type() === "error") record("console_error", { host: service(message.location().url, appOrigin) });
    });
    const recordFrame = (event: string, frame: Frame) =>
      record(event, { host: service(frame.url(), appOrigin), frame: frame.parentFrame() ? "child" : "main" });
    page.on("frameattached", (frame) => recordFrame("frame_attached", frame));
    page.on("framenavigated", (frame) => recordFrame("frame_navigated", frame));
  });

  return {
    record,
    beforeClick() { afterPay = true; record("pay_click_started"); },
    snapshot: () => ({ timeline: [...timeline], omitted }),
    timeoutReason(screen: string, checkout: string, order: string) {
      if (checkout !== "open" || order !== "absent") return "sandbox_provider_state_unresolved";
      if (screen.startsWith("invalid_form:")) return "sandbox_billing_validation_failed";
      if (screen === "invalid_stripe_field") return "sandbox_stripe_component_invalid";
      if (confirmationHttpError) return "sandbox_payment_confirmation_http_error";
      if (confirmationFailed) return "sandbox_payment_confirmation_request_failed";
      if (confirmationRequested) return "sandbox_provider_order_not_created";
      if (unknownProviderWrite) return "sandbox_payment_submission_unclassified";
      return "sandbox_payment_submission_not_observed";
    },
  };
}
