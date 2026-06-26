import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateReportInput, validateReportForUser } from "./report-validation.ts";

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

describe("validateReportForUser", () => {
  it("rejects self-report when target profile id equals reporter user id", () => {
    const reporterId = "11111111-1111-1111-1111-111111111111";
    assert.throws(() =>
      validateReportForUser(
        {
          targetType: "profile",
          targetId: reporterId,
          reason: "spam",
        },
        reporterId,
      ),
    );
  });

  it("allows mock slug targets for UUID reporters", () => {
    const result = validateReportForUser(
      {
        targetType: "profile",
        targetId: "c1",
        reason: "closed_alpha_safety_check",
      },
      "11111111-1111-1111-1111-111111111111",
    );
    assert.equal(result.targetId, "c1");
  });
});
