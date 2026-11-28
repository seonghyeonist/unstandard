import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium } from "@playwright/test";
import { observeCheckout } from "./checkout-observation.mts";

// Compare the existing app-only proxy with passive response observation. All
// orders and provider responses are fixtures; no provider connection is made.
const hosted = "https://sandbox.polar.sh/checkout/private-fixture";
let appOrders = 0;
const server = createServer((request, response) => {
  if (request.url === "/api/b2c/orders" && request.method === "POST") {
    appOrders++;
    response.writeHead(201, { "content-type": "application/json" }).end(JSON.stringify({ checkoutUrl: hosted }));
  } else {
    response.writeHead(200, { "content-type": "text/html" }).end(
      '<button onclick="fetch(\'/api/b2c/orders\', {method: \'POST\'}).then(r => r.json()).then(r => location.assign(r.checkoutUrl))">Open Sandbox checkout</button>');
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch({ executablePath: process.env.B2C_BROWSER });
  for (const mode of ["proxy", "passive"] as const) {
    const context = await browser.newContext();
    try {
      const diagnostics = observeCheckout(context, origin);
      let providerPosts = 0;
      await context.route("https://sandbox.polar.sh/**", async (route) => {
        if (route.request().method() === "POST") {
          providerPosts++;
          await route.fulfill({ status: 204 });
        } else {
          await route.fulfill({ contentType: "text/html", body:
            '<button onclick="fetch(\'/v1/checkouts/client/private-fixture/confirm\', {method: \'POST\'}).then(() => this.textContent = \'Fixture complete\')">Pay now</button>' });
        }
      });
      const page = await context.newPage();
      const orderPath = origin + "/api/b2c/orders";
      let interceptions = 0;
      let capture: Promise<{ status: number; checkoutUrl?: string; bodyUnavailable?: true }>;
      if (mode === "proxy") {
        capture = new Promise((resolve, reject) => {
          void page.route(orderPath, async (route) => {
            try {
              assert.equal(route.request().method(), "POST");
              interceptions++;
              const response = await route.fetch({ maxRedirects: 0 });
              const data = await response.json() as { checkoutUrl: string };
              resolve({ status: response.status(), ...data });
              await route.fulfill({ response });
            } catch (error) { reject(error); }
          }, { times: 1 }).catch(reject);
        });
      } else {
        capture = page.waitForResponse((response) => response.url() === orderPath &&
          response.request().method() === "POST").then(async (response) => {
          try {
            return { status: response.status(), ...await response.json() as { checkoutUrl: string } };
          } catch (error) {
            // The app immediately navigates after consuming JSON. Chromium can
            // discard the response body before the passive reader reaches it.
            if (!(error instanceof Error) || !/No resource with given identifier|No data found for resource|Response body is not available/.test(error.message)) {
              throw error;
            }
            return { status: response.status(), bodyUnavailable: true as const };
          }
        });
      }
      await page.goto(origin);
      await page.getByRole("button", { name: "Open Sandbox checkout" }).click();
      const captured = await capture;
      const bodyUnavailable = captured.bodyUnavailable === true;
      assert.equal(captured.status, 201);
      if (mode === "proxy" || !bodyUnavailable) {
        assert.deepEqual(captured, { status: 201, checkoutUrl: hosted });
      }
      await page.waitForURL(hosted);
      diagnostics.beforeClick();
      await page.getByRole("button", { name: "Pay now", exact: true }).click();
      await page.getByRole("button", { name: "Fixture complete" }).waitFor();
      const writes = diagnostics.snapshot().post_pay_main_polar_writes;
      assert.equal(providerPosts, 1);
      assert.equal(interceptions, mode === "proxy" ? 1 : 0);
      assert.equal(writes.length, 1);
      assert.equal(writes[0].route, "confirmation");
      assert.equal(writes[0].http, 204);
      assert.equal(writes[0].error, undefined);
      assert.ok(!JSON.stringify(diagnostics.snapshot()).includes("private-fixture"));
      console.log("PASS: synthetic " + mode + " app capture, navigation and one provider POST");
      console.log("OBSERVED: " + mode + " response body " + (bodyUnavailable ? "unavailable after navigation" : "captured"));
    } finally { await context.close(); }
  }
  assert.equal(appOrders, 2);
} finally {
  await browser?.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
