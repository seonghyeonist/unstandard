import { createHmac } from "node:crypto";

export const RATE_LIMIT_POLICY_VERSION = "closed-alpha-v2" as const;

export const RATE_LIMIT_POLICIES = {
  inviteClaim: { limit: 10, windowMs: 15 * 60 * 1_000 },
  onboardingAnswer: { limit: 10, windowMs: 10 * 60 * 1_000 },
  unlockAnswer: { limit: 20, windowMs: 10 * 60 * 1_000 },
  reportCreate: { limit: 5, windowMs: 60 * 60 * 1_000 },
  supportCreate: { limit: 3, windowMs: 24 * 60 * 60 * 1_000 },
  messageSend: { limit: 20, windowMs: 10 * 60 * 1_000 },
  waitlistJoin: { limit: 5, windowMs: 24 * 60 * 60 * 1_000 },
} as const;

export type RateLimitScope = keyof typeof RATE_LIMIT_POLICIES;

export function hashRateLimitSubject(
  scope: RateLimitScope,
  subject: string,
  secret: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(`${scope}\u0000${subject}`)
    .digest("hex");
  return `app:${scope}:${digest}`;
}

export function retryAfterSeconds(
  lastRequestMs: number,
  windowMs: number,
  nowMs: number,
): number {
  return Math.max(1, Math.ceil((lastRequestMs + windowMs - nowMs) / 1_000));
}
