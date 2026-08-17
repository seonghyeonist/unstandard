import { createHmac, randomBytes } from "node:crypto";

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
