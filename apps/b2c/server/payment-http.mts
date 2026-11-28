import type { HttpRequest, HttpResponse } from "./request.mts";
import { isIP } from "node:net";
import { InvalidWebhook, sku, uuidPattern } from "./payment-provider.mts";
import { normalizeEmail, PaymentError, proofDigest, purchaseCookie, purchaseToken, tokenPattern, type Payments } from "./payments.mts";
import { json } from "./response.mts";
import { digestToken } from "./session.mts";

const minute = 60_000;
const webhook = "/api/b2c/webhooks/polar";
const routes = new Set([
  "/api/b2c/purchase-proof", "/api/b2c/purchase-proof/rotate", "/api/b2c/orders", "/api/b2c/orders/claim",
  "/api/b2c/recovery/request", "/api/b2c/recovery/claim", webhook,
]);

async function readBody(req: HttpRequest, maxBytes: number) {
  if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json" ||
    (req.headers["content-encoding"] && req.headers["content-encoding"] !== "identity")) {
    throw new PaymentError(415, "content_type");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    total += chunk.length;
    if (total > maxBytes) throw new PaymentError(413, "body_too_large");
    chunks.push(chunk);
  }
  try {
    // Refuse invalid UTF-8 and preserve any BOM for signature verification.
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
  } catch {
    throw new PaymentError(400, "invalid_body");
  }
}

async function readObject(req: HttpRequest): Promise<Record<string, unknown>> {
  const raw = await readBody(req, 1024);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new PaymentError(400, "invalid_body");
  }
}

export function createPaymentHandler(payment: Payments, origin: string, platformIp?: (req: HttpRequest) => string | undefined) {
  return async (req: HttpRequest, res: HttpResponse, path: string) => {
    if (!routes.has(path)) return false;
    try {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        throw new PaymentError(405, "method_not_allowed");
      }
      if (path === webhook) {
        const headers: Record<string, string> = {};
        for (const name of ["webhook-id", "webhook-timestamp", "webhook-signature"]) {
          const value = req.headers[name];
          if (typeof value !== "string" || !value) throw new PaymentError(401, "invalid_signature");
          headers[name] = value;
        }
        const body = await readBody(req, 256 * 1024);
        try {
          const event = await payment.provider.verifyWebhook(body, headers);
          if (event) await payment.ingest(event);
        } catch (error) {
          if (error instanceof InvalidWebhook) throw new PaymentError(401, "invalid_signature_or_envelope");
          throw error;
        }
        json(res, 200, { received: true });
        return true;
      }

      if (req.headers.origin !== origin) throw new PaymentError(403, "origin");
      const ip = platformIp ? platformIp(req) : req.socket.remoteAddress;
      if (!ip || !isIP(ip)) throw new PaymentError(503, "rate_limit_unavailable");
      const owner = proofDigest(req.headers.cookie);
      if (path === "/api/b2c/purchase-proof" || path === "/api/b2c/purchase-proof/rotate") {
        await payment.consumeRate("proof", ip, 30, 60 * minute);
        const rotate = path.endsWith("/rotate");
        if (rotate && !owner) throw new PaymentError(401, "purchase_proof_required");
        if (rotate || !owner) {
          const value = purchaseToken();
          if (owner) await payment.rotateProof(owner, digestToken(value));
          res.setHeader("Set-Cookie", purchaseCookie(value));
        }
        json(res, 200, { ready: true });
        return true;
      }

      if (path === "/api/b2c/orders" || path === "/api/b2c/orders/claim") {
        if (!owner) throw new PaymentError(401, "purchase_proof_required");
        const isOrder = path === "/api/b2c/orders";
        await payment.consumeRate(isOrder ? "order-create" : "order-claim", ip, isOrder ? 10 : 90,
          isOrder ? 60 * minute : 10 * minute);
        const input = await readObject(req);
        if (isOrder) {
          const requestKey = req.headers["idempotency-key"];
          if (typeof requestKey !== "string" || !uuidPattern.test(requestKey) || input.sku !== sku ||
            (input.locale !== "en" && input.locale !== "ko") || Object.keys(input).length !== 2) {
            throw new PaymentError(422, "invalid_order");
          }
          const order = await payment.createOrder(requestKey, owner, input.locale);
          json(res, order.transactionId ? (order.created ? 201 : 200) : 202, { orderId: order.id, transactionId: order.transactionId, checkoutUrl: order.checkoutUrl });
        } else {
          if (typeof input.orderId !== "string" || !uuidPattern.test(input.orderId) || Object.keys(input).length !== 1) {
            throw new PaymentError(422, "invalid_order");
          }
          const result = await payment.claim(input.orderId, owner);
          if ("cookie" in result && result.cookie) res.setHeader("Set-Cookie", result.cookie);
          json(res, result.status, result.status === 200 ? { roomId: result.roomId } : { state: "pending" });
        }
        return true;
      }

      const isRequest = path === "/api/b2c/recovery/request";
      await payment.consumeRate(isRequest ? "recovery-request" : "recovery-claim", ip, 10, 10 * minute);
      const input = await readObject(req);
      if (isRequest) {
        const email = typeof input.email === "string" ? normalizeEmail(input.email) : null;
        if (!email || Object.keys(input).length !== 1) throw new PaymentError(422, "invalid_input");
        await payment.requestRecovery(email);
        json(res, 202, { received: true });
      } else {
        if (typeof input.token !== "string" || !tokenPattern.test(input.token) || Object.keys(input).length !== 1) {
          throw new PaymentError(422, "invalid_input");
        }
        const result = await payment.recover(input.token);
        res.setHeader("Set-Cookie", result.cookie);
        json(res, 200, { roomId: result.roomId });
      }
    } catch (err) {
      if (err instanceof PaymentError) json(res, err.status, { error: err.code });
      else {
        console.error("b2c_payment_request_failed");
        json(res, 503, { error: "temporarily_unavailable" });
      }
    }
    return true;
  };
}
