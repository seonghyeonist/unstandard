import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashWaitlistToken } from "../lib/waitlist/waitlist-token";
import { validateWaitlistJoin } from "../lib/waitlist/waitlist-validation";

describe("waitlist contract", () => {
  it("requires affirmative consent and normalizes email", () => {
    const result = validateWaitlistJoin({
      email: " Person@Example.COM ",
      consent: true,
      acquisitionChannel: "organic",
    });
    assert.equal(result.email, "person@example.com");
    assert.equal(result.acquisitionChannel, "organic");
    assert.throws(() => validateWaitlistJoin({ email: "a@example.com", consent: false }));
    assert.throws(() =>
      validateWaitlistJoin({
        email: "a@example.com",
        consent: true,
        acquisitionChannel: "founder_direct",
      }),
    );
  });

  it("stores a deterministic one-way token hash, not the capability", () => {
    const hash = hashWaitlistToken("raw-capability", "pepper");
    assert.match(hash, /^[a-f0-9]{64}$/u);
    assert.equal(hash.includes("raw-capability"), false);
  });
});
