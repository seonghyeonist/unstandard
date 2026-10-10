import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { normalizeEmail } from "@/lib/auth/invite-crypto";

export const EMAIL_VERIFICATION_CODE_LENGTH = 6;
export const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1_000;
export const EMAIL_VERIFICATION_SEND_COOLDOWN_MS = 60 * 1_000;
export const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;

export function generateEmailVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(EMAIL_VERIFICATION_CODE_LENGTH, "0");
}

/**
 * A short code is never stored as a bare hash. The challenge id and target
 * email are included in a server-keyed MAC so a leaked row is not an offline
 * dictionary oracle for codes from another challenge.
 */
export function hashEmailVerificationCode(
  challengeId: string,
  email: string,
  code: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`unstandard-email-verification\u0000${challengeId}\u0000${normalizeEmail(email)}\u0000${code}`)
    .digest("hex");
}

export function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isValidEmailVerificationCode(code: string): boolean {
  return new RegExp(`^\\d{${EMAIL_VERIFICATION_CODE_LENGTH}}$`).test(code);
}
