import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateReportInput } from "./report-validation.ts";

describe("validateReportInput", () => {
  it("rejects missing targetType", () => {
    assert.throws(() =>
      validateReportInput({ targetType: "user", targetId: "c1", reason: "spam" }),
    );
  });

  it("rejects missing targetId", () => {
    assert.throws(() =>
      validateReportInput({ targetType: "profile", targetId: "  ", reason: "spam" }),
    );
  });

  it("rejects invalid targetId characters", () => {
    assert.throws(() =>
      validateReportInput({ targetType: "profile", targetId: "../admin", reason: "spam" }),
    );
  });

  it("rejects client-supplied reporterUserId", () => {
    assert.throws(() =>
      validateReportInput({
        targetType: "profile",
        targetId: "c1",
        reason: "spam",
        reporterUserId: "attacker",
      }),
    );
  });

  it("accepts valid input", () => {
    const result = validateReportInput({
      targetType: "profile",
      targetId: "c1",
      reason: "closed_alpha_safety_check",
    });
    assert.equal(result.targetId, "c1");
  });
});
