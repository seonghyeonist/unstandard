import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLOSED_ALPHA_SAFETY_RULES_VERSION,
  CLOSED_ALPHA_TERMS_VERSION,
  createRegistrationLegalAcceptance,
  isRegistrationLegalAcceptance,
  parseRegistrationLegalSelection,
} from "./acceptance";

const validSelection = {
  adultConfirmed: true,
  termsAccepted: true,
  safetyRulesAccepted: true,
  termsVersion: CLOSED_ALPHA_TERMS_VERSION,
  safetyRulesVersion: CLOSED_ALPHA_SAFETY_RULES_VERSION,
} as const;

describe("Closed Alpha legal acceptance", () => {
  it("accepts the exact versioned adult/terms/safety contract", () => {
    assert.deepEqual(parseRegistrationLegalSelection(validSelection), validSelection);
  });

  it("rejects missing affirmative checks or stale versions", () => {
    assert.equal(
      parseRegistrationLegalSelection({
        ...validSelection,
        termsAccepted: false,
      }),
      null,
    );
    assert.equal(
      parseRegistrationLegalSelection({
        ...validSelection,
        termsVersion: "old-terms",
      }),
      null,
    );
  });

  it("creates and validates a server-timestamped evidence value", () => {
    const acceptance = createRegistrationLegalAcceptance(
      validSelection,
      "2026-08-21T00:00:00.000Z",
    );
    assert.equal(isRegistrationLegalAcceptance(acceptance), true);
    assert.equal(
      isRegistrationLegalAcceptance({ ...acceptance, acceptedAt: "2026-08-21" }),
      false,
    );
    assert.equal(
      isRegistrationLegalAcceptance({
        ...acceptance,
        acceptedAt: "2099-08-21T00:00:00.000Z",
      }),
      false,
    );
  });
});
