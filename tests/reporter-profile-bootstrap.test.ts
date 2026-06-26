import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateReportForUser } from "../lib/security/report-validation.ts";
import { mapReporterProfileFailure } from "../lib/server/profile/profile-bootstrap.http-mapper.ts";
import {
  reporterProfileSetupRequired,
  reporterProfileSuccess,
} from "../lib/server/profile/profile.types.ts";
import { resolveReporterNickname } from "../lib/server/profile/reporter-nickname.ts";

describe("resolveReporterNickname", () => {
  it("prefers session nickname when present", () => {
    assert.equal(
      resolveReporterNickname({
        id: "11111111-1111-1111-1111-111111111111",
        nickname: "  alpha-user  ",
      }),
      "alpha-user",
    );
  });

  it("falls back to email local part", () => {
    assert.equal(
      resolveReporterNickname({
        id: "11111111-1111-1111-1111-111111111111",
        email: "reporter@example.com",
      }),
      "reporter",
    );
  });

  it("falls back to stable user prefix when nickname and email missing", () => {
    const nickname = resolveReporterNickname({
      id: "11111111-1111-1111-1111-111111111111",
    });
    assert.equal(nickname.startsWith("user-"), true);
    assert.equal(nickname.length <= 64, true);
  });
});

describe("mapReporterProfileFailure", () => {
  it("maps setup required to 409 without DB internals", () => {
    const mapped = mapReporterProfileFailure(reporterProfileSetupRequired());
    assert.equal(mapped.status, 409);
    assert.equal(mapped.body.error, "Profile setup required before reporting");
    assert.equal(mapped.body.error.includes("23503"), false);
    assert.equal(mapped.body.error.includes("PostgREST"), false);
  });
});

describe("reporter profile bootstrap result", () => {
  it("uses auth user id as profile id on success", () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const result = reporterProfileSuccess(userId);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.profileId, userId);
    }
  });
});

describe("self-report validation with profile id namespace", () => {
  it("still blocks reporting own profile when target id equals auth user id", () => {
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

  it("allows mock slug targets when reporter id is auth uuid", () => {
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
