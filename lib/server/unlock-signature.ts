import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure unlock signature helpers — testable without Next.js cookie APIs.
 * Production must fail closed when AUTH_COOKIE_SECRET is missing.
 */

export function resolveCookieSecret(nodeEnv: string | undefined, secret: string | undefined): string {
  if (nodeEnv === "production" && !secret) {
    throw new Error("AUTH_COOKIE_SECRET is required in production");
  }
  return secret ?? "dev-only-insecure-local-demo";
}

export function signUnlockToken(profileId: string, userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${profileId}:${userId}`).digest("hex");
}

export function verifyUnlockToken(
  profileId: string,
  userId: string,
  value: string,
  secret: string,
): boolean {
  const expected = signUnlockToken(profileId, userId, secret);
  if (value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
