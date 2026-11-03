import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const WAITLIST_COOKIE_NAME = "unstandard_waitlist" as const;
export const WAITLIST_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export function generateWaitlistToken(): string {
  return randomBytes(32).toString("base64url");
}

export function requireWaitlistPepper(): string {
  const pepper =
    process.env.WAITLIST_TOKEN_PEPPER?.trim() || process.env.BETTER_AUTH_SECRET?.trim();
  if (!pepper) throw new Error("WAITLIST_TOKEN_PEPPER or BETTER_AUTH_SECRET is required");
  return pepper;
}

export function hashWaitlistToken(rawToken: string, pepper: string): string {
  return createHmac("sha256", pepper).update(`waitlist:${rawToken}`).digest("hex");
}

// Signed acceptance receipts are issued for BOTH new and duplicate submissions.
// A receipt proves this browser submitted, not that it owns an existing email.
export function generateWaitlistReceipt(): string {
  const nonce = generateWaitlistToken();
  const signature = createHmac("sha256", requireWaitlistPepper()).update(`receipt:${nonce}`).digest("base64url");
  return `${nonce}.${signature}`;
}
export function isWaitlistReceipt(token: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/u.test(token)) return false;
  const [nonce, signature] = token.split(".");
  const expected = createHmac("sha256", requireWaitlistPepper()).update(`receipt:${nonce}`).digest("base64url");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
