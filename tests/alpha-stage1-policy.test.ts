import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALPHA_STAGE_1_CAP,
  ALPHA_STAGE_1_MAX_DAYS,
  ALPHA_BALANCE_CONSENT_VERSION,
  evaluateBalanceGate,
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
