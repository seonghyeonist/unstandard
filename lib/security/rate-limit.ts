import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  hashRateLimitSubject,
  RATE_LIMIT_POLICIES,
  retryAfterSeconds,
  type RateLimitScope,
} from "@/lib/security/rate-limit-policy";

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; retryAfterSeconds: number };

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("rate-limit storage unavailable");
    this.name = "RateLimitUnavailableError";
  }
}

function requireRateLimitSecret(): string {
  const secret =
    process.env.AUTH_COOKIE_SECRET?.trim() || process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) throw new RateLimitUnavailableError();
  return secret;
}

export function requestIpAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded?.slice(0, 128) || "unknown";
}

export async function consumeRateLimit(input: {
  scope: RateLimitScope;
  subject: string;
  nowMs?: number;
}): Promise<RateLimitDecision> {
  const policy = RATE_LIMIT_POLICIES[input.scope];
  const nowMs = input.nowMs ?? Date.now();
  const key = hashRateLimitSubject(input.scope, input.subject, requireRateLimitSecret());
  const staleBefore = nowMs - 2 * 24 * 60 * 60 * 1_000;

  try {
    const result = await getDb().execute<{ count: number; last_request: number }>(sql`
      WITH pruned AS (
        DELETE FROM rate_limits
        WHERE last_request < ${staleBefore}
        RETURNING key
      ), upserted AS (
        INSERT INTO rate_limits (id, key, count, last_request)
        VALUES (${key}, ${key}, 1, ${nowMs})
        ON CONFLICT (key) DO UPDATE SET
          count = CASE
            WHEN ${nowMs} - rate_limits.last_request >= ${policy.windowMs} THEN 1
            ELSE rate_limits.count + 1
          END,
          last_request = CASE
            WHEN ${nowMs} - rate_limits.last_request >= ${policy.windowMs} THEN ${nowMs}
            ELSE rate_limits.last_request
          END
        RETURNING count, last_request
      )
      SELECT count, last_request FROM upserted
    `);
    const row = result.rows[0];
    if (!row) throw new RateLimitUnavailableError();

    const count = Number(row.count);
    const lastRequest = Number(row.last_request);
    if (count <= policy.limit) {
      return { allowed: true, remaining: policy.limit - count };
    }
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: retryAfterSeconds(lastRequest, policy.windowMs, nowMs),
    };
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) throw error;
    throw new RateLimitUnavailableError();
  }
}
