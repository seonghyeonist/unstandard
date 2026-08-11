import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateReportForUser } from "../lib/security/report-validation.ts";

describe("report actor identity", () => {
  const authUserId = "auth-user-123";
  const profileId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  it("rejects forged reporterUserId from client input", () => {
    assert.throws(() =>
      validateReportForUser(
        {
          targetType: "profile",
          targetId: profileId,
          reason: "spam",
          reporterUserId: "forged-user-id",
        },
        authUserId,
        profileId,
      ),
    );
  });

  it("rejects self-report when target equals reporter profile id", () => {
    assert.throws(() =>
      validateReportForUser(
        {
          targetType: "profile",
          targetId: profileId,
          reason: "self",
        },
        authUserId,
        profileId,
      ),
    );
  });

  it("allows reporting another profile while preserving auth user id contract", () => {
    const validated = validateReportForUser(
      {
        targetType: "profile",
        targetId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        reason: "abuse",
      },
      authUserId,
      profileId,
    );

    assert.equal(validated.targetType, "profile");
    assert.notEqual(validated.targetId, authUserId);
    assert.notEqual(validated.targetId, profileId);
  });

  it("never treats profile id as reporter user id during validation", () => {
    assert.throws(() =>
      validateReportForUser(
        {
          targetType: "profile",
          targetId: authUserId,
          reason: "self by user id",
        },
        authUserId,
        profileId,
      ),
    );
  });
});
