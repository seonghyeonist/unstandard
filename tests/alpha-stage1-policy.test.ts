import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALPHA_STAGE_1_CAP,
  ALPHA_STAGE_1_MAX_DAYS,
  ALPHA_BALANCE_CONSENT_VERSION,
  evaluateBalanceGate,
  evaluateInviteBalanceGate,
  validateAlphaBalanceConsent,
} from "../lib/alpha/stage1-policy";

describe("alpha Stage 1 policy", () => {
  it("fixes the founder-approved cap and maximum observation window", () => {
    assert.equal(ALPHA_STAGE_1_CAP, 50);
    assert.equal(ALPHA_STAGE_1_MAX_DAYS, 42);
  });

  it("implements the v4.2 balance boundaries exactly", () => {
    assert.equal(evaluateBalanceGate(6, 4).gate, "OPEN");
    assert.equal(evaluateBalanceGate(7, 4).gate, "BOOST_MINORITY");
    assert.equal(evaluateBalanceGate(65, 35).gate, "SOFT_WAITLIST");
    assert.equal(evaluateBalanceGate(7, 3).gate, "HARD_GATE");
    assert.equal(evaluateBalanceGate(3, 7).minorityBucket, "bucket_a");
  });

  it("rejects invalid counts instead of manufacturing a ratio", () => {
    assert.throws(() => evaluateBalanceGate(-1, 2));
    assert.throws(() => evaluateBalanceGate(1.5, 2));
  });

  it("allows the first counted invitation from either side and breaks a tie", () => {
    for (const bucket of ["bucket_a", "bucket_b"] as const) {
      assert.equal(evaluateInviteBalanceGate(0, 0, bucket).rejection, null);
      assert.equal(evaluateInviteBalanceGate(1, 1, bucket).rejection, null);
    }
  });

  it("keeps the soft/hard limits for growth of the existing majority", () => {
    assert.equal(evaluateInviteBalanceGate(1, 0, "bucket_a").rejection, "BALANCE_HARD_GATE");
    assert.equal(evaluateInviteBalanceGate(0, 1, "bucket_b").rejection, "BALANCE_HARD_GATE");
    assert.equal(evaluateInviteBalanceGate(12, 7, "bucket_a").rejection, "BALANCE_SOFT_WAITLIST");
    assert.equal(evaluateInviteBalanceGate(7, 12, "bucket_b").rejection, "BALANCE_SOFT_WAITLIST");
    assert.equal(evaluateInviteBalanceGate(6, 3, "bucket_a").rejection, "BALANCE_HARD_GATE");
  });

  it("permits minority recovery even when the projected ratio remains above 70%", () => {
    assert.equal(evaluateInviteBalanceGate(10, 0, "bucket_b").rejection, null);
    assert.equal(evaluateInviteBalanceGate(0, 10, "bucket_a").rejection, null);
    assert.equal(evaluateInviteBalanceGate(10, 0, "not_counted").rejection, null);
    assert.equal(evaluateInviteBalanceGate(5, 4, "bucket_a").rejection, null);
  });

  it("counts A/B only with the exact consent contract and a valid UTC date", () => {
    assert.doesNotThrow(() =>
      validateAlphaBalanceConsent("bucket_a", {
        version: ALPHA_BALANCE_CONSENT_VERSION,
        consentedOn: "2026-08-17",
      }),
    );
    assert.throws(() => validateAlphaBalanceConsent("bucket_b", null), /BALANCE_CONSENT_REQUIRED/u);
    assert.throws(
      () =>
        validateAlphaBalanceConsent("bucket_a", {
          version: ALPHA_BALANCE_CONSENT_VERSION,
          consentedOn: "2026-02-30",
        }),
      /BALANCE_CONSENT_DATE_INVALID/u,
    );
    assert.throws(
      () =>
        validateAlphaBalanceConsent("not_counted", {
          version: ALPHA_BALANCE_CONSENT_VERSION,
          consentedOn: "2026-08-17",
        }),
      /NOT_COUNTED_MUST_NOT_HAVE_BALANCE_CONSENT/u,
    );
    assert.doesNotThrow(() => validateAlphaBalanceConsent("not_counted", null));
  });
});
