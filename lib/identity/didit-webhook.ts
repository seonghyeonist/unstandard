import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Match Didit's V3 canonical form: recursively sorted keys, compact JSON, UTF-8 Unicode. */
function sortAndShorten(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortAndShorten);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [
      key,
      sortAndShorten((value as Record<string, unknown>)[key]),
    ]));
  }
  // JSON.parse already turns 1.0 into the integer 1. Keep this explicit so
  // callers using a constructed payload follow Didit's float normalization.
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) return Math.trunc(value);
  return value;
}

export function canonicalizeDiditWebhook(payload: unknown): string {
  return JSON.stringify(sortAndShorten(payload));
}

/** V2 authenticates the complete decision body; the route may also use the documented envelope fallback. */
export function verifyDiditWebhookSignature(input: {
  payload: unknown; signature: string | null; timestamp: string | null; secret: string;
  nowSeconds?: number;
}): boolean {
  if (!input.signature || !input.timestamp || !/^\d+$/.test(input.timestamp)) return false;
  if (!/^[0-9a-fA-F]{64}$/.test(input.signature)) return false;
  const timestamp = Number(input.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) return false;
  const expected = createHmac("sha256", input.secret).update(canonicalizeDiditWebhook(input.payload), "utf8").digest();
  const actual = Buffer.from(input.signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Envelope-only fallback documented by Didit. The route must re-fetch before acting. */
export function verifyDiditWebhookSimpleSignature(input: {
  timestamp: string | null; sessionId: string | null; status: string | null;
  webhookType: string | null; signature: string | null; secret: string; nowSeconds?: number;
}): boolean {
  if (!input.signature || !input.timestamp || !input.sessionId || !input.status || !input.webhookType) return false;
  if (!/^[0-9a-fA-F]{64}$/.test(input.signature) || !/^\d+$/.test(input.timestamp)) return false;
  const timestamp = Number(input.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) return false;
  const expected = createHmac("sha256", input.secret)
    .update(`${input.timestamp}:${input.sessionId}:${input.status}:${input.webhookType}`, "utf8")
    .digest();
  const actual = Buffer.from(input.signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** A stable non-secret fingerprint for internal tests/evidence; never use as an identifier or log payloads. */
export function diditWebhookBodyFingerprint(payload: unknown): string {
  return createHash("sha256").update(canonicalizeDiditWebhook(payload), "utf8").digest("hex");
}
