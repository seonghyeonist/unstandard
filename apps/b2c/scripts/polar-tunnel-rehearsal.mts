import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { createPolar } from "@polar-sh/sdk/2026-10";
import { databaseTarget } from "../db/client.mts";
import handler from "../api/b2c/[...path].ts";
import { PolarSandboxProvider, polarEvents } from "../server/polar-provider.mts";
import { allowWrites, Blocked, delay, required, summarize } from "./sandbox-helpers.mts";

const localPort = 4173;
const webhookPath = "/api/b2c/webhooks/polar";

function tunnelOrigin(process: ChildProcess) {
  return new Promise<string>((resolve, reject) => {
    let recent = "";
    const timer = setTimeout(() => reject(new Blocked("temporary_https_origin_unavailable")), 40_000);
    function read(chunk: Buffer) {
      recent = (recent + chunk.toString("utf8")).slice(-8192);
      const url = recent.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i)?.[0];
      if (url) {
        clearTimeout(timer);
        resolve(url);
      }
    }
    // Cloudflared stays drained throughout the run. URLs and raw CLI logs stay private.
    process.stdout?.on("data", read);
    process.stderr?.on("data", read);
    process.once("error", () => {
      clearTimeout(timer);
      reject(new Blocked("temporary_https_client_unavailable"));
    });
    process.once("exit", () => {
      clearTimeout(timer);
      reject(new Blocked("temporary_https_tunnel_exited"));
    });
  });
}

async function handle(origin: string, incoming: IncomingMessage, outgoing: ServerResponse) {
  const url = new URL(incoming.url ?? "/", origin);
  const ip = incoming.headers["cf-connecting-ip"];
  if (url.origin !== origin || typeof ip !== "string" || !isIP(ip)) {
    outgoing.writeHead(400).end();
    return;
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) for (const item of value) headers.append(key, item);
  }
  // The loopback ingress trusts the Cloudflare edge's client IP, not visitor-supplied forwarding headers.
  headers.set("x-forwarded-for", ip);
  const method = incoming.method ?? "GET";
  const init: RequestInit & { duplex?: "half" } = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
    init.duplex = "half";
  }
  const response = await handler.fetch(new Request(url, init));
  for (const [name, value] of response.headers) if (name !== "set-cookie") outgoing.setHeader(name, value);
  const cookies = response.headers.getSetCookie();
  if (cookies.length) outgoing.setHeader("Set-Cookie", cookies);
  outgoing.writeHead(response.status).end(Buffer.from(await response.arrayBuffer()));
}

async function waitForTransport(origin: string) {
  let status: number | undefined;
  let errorType: string | undefined;
  const networkCodes = new Set<string>();
  const allowedNetworkCodes = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
    "ENETUNREACH", "EHOSTUNREACH", "ABORT_ERR", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID"]);
  function collectNetworkCodes(error: unknown, depth = 0) {
    if (depth >= 5 || !error || typeof error !== "object") return;
    if ("code" in error && typeof error.code === "string" && allowedNetworkCodes.has(error.code)) {
      networkCodes.add(error.code);
    }
    if (error instanceof AggregateError) {
      for (const nested of error.errors.slice(0, 8)) collectNetworkCodes(nested, depth + 1);
    }
    if ("cause" in error) collectNetworkCodes(error.cause, depth + 1);
  }
  const deadline = Date.now() + 90_000;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts++;
    try {
      const reply = await fetch(origin + "/", { redirect: "error", signal: AbortSignal.timeout(4000) });
      status = reply.status;
      if (status === 204) return;
    } catch (error) {
      errorType = error instanceof Error && /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : "Unknown";
      collectNetworkCodes(error);
    }
    await delay(2000);
  }
  console.log(JSON.stringify({ layer: "polar_temporary_https", status: "FAIL", stage: "https_transport_verified",
    http_status: status, error_type: errorType, network_codes: [...networkCodes].sort(), attempts }));
  throw new Blocked("temporary_https_transport_not_verified");
}

async function waitForGates(origin: string) {
  let last: { checkout: number; checkoutChallenge: boolean; webhook: number; webhookCode?: string } | undefined;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const options = { redirect: "error", signal: AbortSignal.timeout(3000) } as const;
      const checkout = await fetch(origin + "/checkout", options);
      const webhook = await fetch(origin + webhookPath, { ...options, method: "POST" });
      const body = await webhook.json().catch(() => null);
      const allowedCodes = ["invalid_signature", "sandbox_access_required", "temporarily_unavailable", "not_found"];
      last = { checkout: checkout.status, checkoutChallenge: checkout.headers.has("www-authenticate"),
        webhook: webhook.status, webhookCode: allowedCodes.includes(body?.error) ? body.error : undefined };
      if (last.checkout === 401 && last.checkoutChallenge && last.webhook === 401 &&
          last.webhookCode === "invalid_signature") return;
    } catch {}
    await delay(2000);
  }
  console.log(JSON.stringify({ layer: "polar_temporary_https", stage: "origin_and_gates", status: "FAIL", observed: last }));
  throw new Blocked("temporary_https_gates_not_verified");
}

function providerFailure(stage: string, error: unknown): never {
  const status = error instanceof Error && "statusCode" in error && typeof error.statusCode === "number"
    ? error.statusCode : null;
  const errorType = error instanceof Error && /^[A-Za-z0-9]{1,80}$/.test(error.name) ? error.name : "Unknown";
  const detail = error instanceof Error && "error" in error && error.error && typeof error.error === "object" &&
    "detail" in error.error ? error.error.detail : null;
  const knownFields = new Set(["body", "url", "events", "organization_id", "format", "api_version", "name"]);
  const validation = Array.isArray(detail) ? detail.slice(0, 5).map((item) => {
    const loc = Array.isArray(item?.loc) ? item.loc.filter((part: string) => knownFields.has(part)) : [];
    const type = typeof item?.type === "string" && /^[a-z_0-9]{1,60}$/.test(item.type) ? item.type : null;
    return { loc, type };
  }) : undefined;
  console.log(JSON.stringify({ layer: "polar_temporary_https", stage, status: "FAIL", http_status: status,
    error_type: errorType, validation }));
  if (status === 401 || status === 403) throw new Blocked(stage + "_authorization");
  throw new Error(stage + "_failed");
}

await summarize("polar_temporary_https", async () => {
  allowWrites("checkout-b2c-polar-sandbox");
  if (!databaseTarget().local) throw new Error("temporary_https_requires_disposable_loopback_database");
  const setup = required("B2C_POLAR_E2E_WEBHOOK_TOKEN");
  const runtime = required("B2C_POLAR_ACCESS_TOKEN");
  const refund = required("B2C_POLAR_E2E_REFUND_TOKEN");
  if (new Set([setup, runtime, refund]).size !== 3 ||
      [setup, runtime, refund].some((value) => !/^polar_oat_[a-z0-9_-]+$/i.test(value))) {
    throw new Error("three_separate_sandbox_tokens_required");
  }
  const organizationId = required("B2C_POLAR_ORGANIZATION_ID");
  const productId = required("B2C_POLAR_PRODUCT_ID");
  const catalog = new PolarSandboxProvider({ accessToken: runtime, organizationId, productId,
    webhookSecret: "unused-before-provider-configuration", origin: "https://p2.example.test" });
  await catalog.validateCatalog().catch((error: unknown) => providerFailure("sandbox_catalog", error));
  console.log(JSON.stringify({ layer: "polar_temporary_https", status: "PASS", stage: "sandbox_catalog" }));
  const latest = await catalog.client.checkouts.list({
    organization_id: organizationId, product_id: productId, sorting: ["-created_at"], limit: 1,
  });
  const [prior] = latest.items;
  if (prior) {
    const orders = await catalog.client.orders.list({
      organization_id: organizationId, checkout_id: prior.id, limit: 2,
    });
    let orderState = "absent";
    const [order] = orders.items;
    if (order) {
      const refunds = await catalog.client.refunds.list({ order_id: order.id, limit: 2 });
      const [refund] = refunds.items;
      if (orders.items.length !== 1 || refunds.items.length !== 1 ||
          order.checkout_id !== prior.id || order.product_id !== productId ||
          typeof prior.metadata.b2c_order_id !== "string" ||
          prior.metadata.b2c_order_id !== order.metadata.b2c_order_id ||
          order.currency.toUpperCase() !== "USD" || order.net_amount !== 899 ||
          !refund || refund.status !== "succeeded" ||
          refund.amount !== order.net_amount || refund.tax_amount !== order.tax_amount) {
        throw new Blocked("previous_sandbox_checkout_requires_reconciliation");
      }
      orderState = "fully_refunded";
    } else if (prior.status !== "expired" && prior.status !== "failed") {
      throw new Blocked("previous_sandbox_checkout_requires_reconciliation");
    }
    console.log(JSON.stringify({ layer: "polar_temporary_https", status: "PASS", stage: "prior_checkout_reconciled",
      checkout_status: prior.status, order_state: orderState }));
  }
  const sdk = createPolar({ accessToken: setup, environment: "sandbox", timeout: 10 });
  const tunnel = spawn(required("B2C_CLOUDFLARED"), ["tunnel", "--no-autoupdate", "--protocol", "http2", "--url",
    "http://127.0.0.1:" + localPort], { env: { PATH: process.env.PATH }, stdio: ["ignore", "pipe", "pipe"] });
  let endpoint: string | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  let ready = false;
  try {
    const origin = await tunnelOrigin(tunnel);
    console.log(JSON.stringify({ layer: "polar_temporary_https", status: "PASS", stage: "temporary_origin_assigned" }));
    server = createServer({ requestTimeout: 30_000 }, (req, res) => {
      if (!ready) {
        res.writeHead(req.method === "GET" && req.url === "/" ? 204 : 503).end();
        return;
      }
      void handle(origin, req, res).catch(() => {
        if (!res.headersSent) res.writeHead(503);
        res.end();
      });
    });
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject).listen(localPort, "127.0.0.1", resolve);
    });
    await waitForTransport(origin);
    console.log(JSON.stringify({ layer: "polar_temporary_https", status: "PASS", stage: "https_transport_verified" }));
    const destination = await sdk.webhooks.createWebhookEndpoint({
      name: "UNSTANDARD P2 " + randomUUID().slice(0, 8),
      url: origin + webhookPath, format: "raw", api_version: "2026-10", events: [...polarEvents],
    }).catch((error: unknown) => providerFailure("sandbox_webhook_create", error));
    endpoint = destination.id;
    if (destination.url !== origin + webhookPath || destination.organization_id !== organizationId ||
        !destination.enabled || !destination.uses_standard_webhook_signature || !destination.secret) {
      throw new Error("temporary_webhook_config_mismatch");
    }
    Object.assign(process.env, {
      B2C_PAYMENT_MODE: "sandbox", B2C_ORIGIN: origin,
      B2C_POLAR_WEBHOOK_SECRET: destination.secret,
      B2C_PAYMENT_TOKEN_KEY: randomBytes(32).toString("hex"),
      B2C_SANDBOX_ACCESS_KEY: randomBytes(32).toString("hex"),
    });
    ready = true;
    const localCheck = await handler.fetch(new Request(origin + webhookPath, { method: "POST" }));
    if (localCheck.status !== 401 || (await localCheck.json()).error !== "invalid_signature") {
      throw new Error("local_unsigned_webhook_gate_failed");
    }
    await waitForGates(origin);
    console.log(JSON.stringify({ layer: "polar_temporary_https", status: "PASS", stage: "origin_and_gates" }));
    const result = await new Promise<number | null>((resolve, reject) => {
      const env = { ...process.env };
      delete env.B2C_POLAR_E2E_WEBHOOK_TOKEN;
      const checkout = spawn(process.execPath, [new URL("./checkout-sandbox.mts", import.meta.url).pathname],
        { env, stdio: ["ignore", "inherit", "inherit"] });
      checkout.once("error", reject).once("exit", resolve);
    });
    if (result === 78) throw new Blocked("checkout_rehearsal_blocked");
    if (result !== 0) throw new Error("checkout_rehearsal_failed");
    return { checkout_refund: "PASS" };
  } finally {
    try {
      if (endpoint) {
        const disabled = await sdk.webhooks.updateWebhookEndpoint(endpoint, { enabled: false });
        if (disabled.enabled || disabled.id !== endpoint) throw new Error("sandbox_webhook_cleanup_unverified");
        console.log(JSON.stringify({ layer: "polar_temporary_https", status: "PASS", stage: "temporary_webhook_disabled" }));
      }
    } finally {
      server?.close();
      tunnel.kill();
    }
  }
});
