import { chromium, type Locator } from "@playwright/test";
import { hostedSandboxCheckout } from "../server/polar-provider.mts";
import { Blocked } from "./sandbox-helpers.mts";

async function publicFieldState(field: Locator, expectedDigits: string) {
  return field.evaluate((element, expected) => {
    if (!(element instanceof HTMLInputElement)) return { input: false };
    const invalid = element.getAttribute("aria-invalid");
    return {
      input: true,
      populated: element.value.length > 0,
      digits_match: element.value.replace(/\D/g, "") === expected,
      native_valid: element.validity.valid,
      aria_invalid: invalid === "false" ? "false" : invalid === "true" ? "true" : "unavailable",
      stripe_complete_class: element.classList.contains("Input--complete"),
      stripe_invalid_class: element.classList.contains("Input--invalid"),
      described: element.hasAttribute("aria-describedby"),
    };
  }, expectedDigits, { timeout: 5_000 });
}

export async function inspectHostedCheckout(checkoutUrl: string) {
  const url = new URL(hostedSandboxCheckout(checkoutUrl));
  const browser = await chromium.launch({
    channel: "chrome",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.RUNNER_TEMP },
  }).catch(() => { throw new Blocked("hosted_inspection_chrome_unavailable"); });
  try {
    const context = await browser.newContext({ locale: "en-US", serviceWorkers: "block" });
    let blockedWrites = 0;
    await context.route("**/*", async (route) => {
      const request = route.request();
      const target = new URL(request.url());
      const sandbox = target.hostname === "sandbox.polar.sh" || target.hostname.endsWith(".sandbox.polar.sh");
      const stripe = target.hostname === "stripe.com" || target.hostname.endsWith(".stripe.com");
      if (!["GET", "HEAD"].includes(request.method())) {
        blockedWrites++;
        return route.abort("blockedbyclient");
      }
      if (target.protocol === "https:" && (sandbox || stripe) && !request.redirectedFrom()) return route.continue();
      return route.abort("blockedbyclient");
    });

    const page = await context.newPage();
    const response = await page.goto(url.href, { timeout: 20_000, waitUntil: "domcontentloaded" })
      .catch(() => { throw new Blocked("hosted_inspection_navigation_failed"); });
    if (!response?.ok() || new URL(page.url()).origin !== url.origin) {
      throw new Blocked("hosted_inspection_navigation_failed");
    }
    const fields = [
      ["number", /Card number/i, "4242424242424242", "4242424242424241"],
      ["expiry", /Expir/i, "12" + String(new Date().getUTCFullYear() + 3).slice(-2), "1329"],
      ["security_code", /Security code|CVC/i, "123", "12"],
    ] as const;
    const results: Record<string, unknown> = {};
    for (const [name, label, digits, malformed] of fields) {
      const deadline = Date.now() + 15_000;
      let field: Locator | undefined;
      while (!field && Date.now() < deadline) {
        for (const frame of page.frames()) {
          if (URL.parse(frame.url())?.origin !== "https://js.stripe.com") continue;
          const candidate = frame.getByRole("textbox", { name: label }).first();
          if (await candidate.isVisible()) { field = candidate; break; }
        }
        if (!field) await new Promise<void>((resolve) => setTimeout(resolve, 250));
      }
      if (!field) {
        results[name] = "field_not_visible";
        continue;
      }
      const before = await publicFieldState(field, "");
      await field.pressSequentially(malformed, { delay: 55, timeout: 10_000 });
      await field.press("Tab", { timeout: 5_000 });
      const invalid = await publicFieldState(field, malformed);
      await field.clear({ timeout: 5_000 });
      await field.pressSequentially(digits, { delay: 55, timeout: 10_000 });
      await field.press("Tab", { timeout: 5_000 });
      const after = await publicFieldState(field, digits);
      results[name] = { before, invalid, after };
    }
    return { public_fields: results, intercepted_non_read_requests: blockedWrites, pay_clicks: 0 };
  } finally {
    await browser.close();
  }
}
