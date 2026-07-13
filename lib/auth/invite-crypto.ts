import { createHash, randomBytes } from "node:crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashInviteCode(rawCode: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${rawCode}`).digest("hex");
}

export function generateInviteCode(): string {
  return randomBytes(24).toString("base64url");
}

export function requireInvitePepper(): string {
  const pepper = process.env.ALPHA_INVITE_PEPPER?.trim() || process.env.BETTER_AUTH_SECRET?.trim();
  if (!pepper) {
    throw new Error("ALPHA_INVITE_PEPPER or BETTER_AUTH_SECRET is required for invite operations");
  }
  return pepper;
}
