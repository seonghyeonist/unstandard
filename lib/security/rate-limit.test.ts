import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashRateLimitSubject,
  RATE_LIMIT_POLICY_VERSION,
  retryAfterSeconds,
} from "./rate-limit-policy.ts";

describe("closed-alpha rate-limit policy", () => {
  it("uses stable, scoped, non-plaintext subjects", () => {
    const first = hashRateLimitSubject("inviteClaim", "203.0.113.4", "secret");
    const again = hashRateLimitSubject("inviteClaim", "203.0.113.4", "secret");
    const otherScope = hashRateLimitSubject("reportCreate", "203.0.113.4", "secret");

    assert.equal(RATE_LIMIT_POLICY_VERSION, "closed-alpha-v3");
    assert.equal(first, again);
    assert.notEqual(first, otherScope);
    assert.equal(first.includes("203.0.113.4"), false);
  });

  it("returns a positive, rounded-up Retry-After", () => {
    assert.equal(retryAfterSeconds(1_000, 60_000, 1_500), 60);
    assert.equal(retryAfterSeconds(1_000, 60_000, 70_000), 1);
  });
});
