import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attributionFrom, sanitizeUtm, validateClientEvent, isSameOrigin } from "../lib/acquisition/policy";
import { validateWaitlistJoin } from "../lib/waitlist/waitlist-validation";
describe("acquisition privacy boundary", () => {
  it("distinguishes paid, organic, Everytime and unattributed declared sources", () => {
    assert.equal(attributionFrom({ utm_source: "instagram", utm_medium: "paid_social" }).channel, "instagram_paid");
    assert.equal(attributionFrom({ utm_source: "instagram", utm_medium: "organic_social" }).channel, "instagram_organic");
    assert.equal(attributionFrom({ utm_source: "everytime", utm_medium: "social" }).channel, "everytime");
    assert.equal(attributionFrom({}).channel, "direct_or_unattributed");
    assert.equal(attributionFrom({ utm_source: "instagram" }).channel, "other_unknown");
  });
  it("discards arbitrary strings, email and excessive lengths and is idempotent", () => {
    const dirty = { utm_source: "person@example.com", utm_medium: "x".repeat(1000), utm_campaign: "alpha_recruitment", utm_content: "reel_a", email: "person@example.com" };
    const safe = sanitizeUtm(dirty);
    assert.equal(JSON.stringify(safe).includes("person@"), false);
    assert.equal(safe.utm_source, "unknown");
    assert.deepEqual(sanitizeUtm(safe), safe);
    assert.deepEqual(sanitizeUtm(sanitizeUtm({})), sanitizeUtm({}));
  });
  it("rejects forged server conversion events and accepts only named browser events", () => {
    for (const event of ["waitlist_created", "waitlist_submit_accepted", "email", undefined]) assert.throws(() => validateClientEvent({ event }));
    assert.equal(validateClientEvent({ event: "landing_view" }).event, "landing_view");
  });
  it("retains the trusted channel boundary and normalizes declared attribution separately", () => {
    assert.throws(() => validateWaitlistJoin({ email: "bad", consent: true }));
    assert.throws(() => validateWaitlistJoin({ email: "a@example.com", consent: false }));
    assert.throws(() => validateWaitlistJoin({ email: "a@example.com", consent: true, acquisitionChannel: "instagram_paid" }));
    const result = validateWaitlistJoin({ email: "A@EXAMPLE.COM", consent: true, utm: { utm_source: "instagram", utm_medium: "paid_social" } });
    assert.equal(result.email, "a@example.com");
    assert.equal(result.acquisitionChannel, "organic");
    assert.equal(result.attribution.channel, "instagram_paid");
  });
});

import { generateWaitlistReceipt, isWaitlistReceipt } from "../lib/waitlist/waitlist-token";
it("acceptance receipts cannot be forged and do not reveal email identity", () => {
  const old = process.env.WAITLIST_TOKEN_PEPPER;
  process.env.WAITLIST_TOKEN_PEPPER = "test-receipt-secret";
  try {
    const first = generateWaitlistReceipt();
    const second = generateWaitlistReceipt();
    assert.equal(first.length, second.length);
    assert.notEqual(first, second);
    assert.equal(isWaitlistReceipt(first), true);
    assert.equal(isWaitlistReceipt(first.slice(0, -1) + (first.endsWith("x") ? "y" : "x")), false);
    assert.equal(isWaitlistReceipt("legacy-token"), false);
  } finally {
    if (old === undefined) delete process.env.WAITLIST_TOKEN_PEPPER; else process.env.WAITLIST_TOKEN_PEPPER = old;
  }
});

it("checks browser origin against the external host rather than an internal Next URL", () => {
  assert.equal(isSameOrigin("https://preview.vercel.app", "preview.vercel.app"), true);
  assert.equal(isSameOrigin("http://127.0.0.1:3013", "127.0.0.1:3013"), true);
  assert.equal(isSameOrigin("https://evil.example", "preview.vercel.app"), false);
  assert.equal(isSameOrigin(null, "preview.vercel.app"), false);
  assert.equal(isSameOrigin("https://preview.vercel.app.evil.example", "preview.vercel.app"), false);
});
