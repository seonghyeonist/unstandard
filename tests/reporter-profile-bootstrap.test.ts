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

  it("does not use email local-part when nickname is missing", () => {
    const nickname = resolveReporterNickname({
      id: "11111111-1111-1111-1111-111111111111",
      email: "reporter@example.com",
    });
    assert.equal(nickname, "user-11111111");
    assert.equal(nickname.includes("reporter"), false);
  });

  it("falls back to stable user prefix when nickname is missing", () => {
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
  it("returns profile id distinct from auth user id", () => {
    const authUserId = "11111111-1111-1111-1111-111111111111";
    const profileId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const result = reporterProfileSuccess(profileId);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.profileId, profileId);
      assert.notEqual(result.profileId, authUserId);
    }
  });
});

describe("self-report validation with profile id namespace", () => {
  it("blocks reporting own profile when target id equals auth user id", () => {
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

  it("blocks reporting own profile when target id equals reporter profile id", () => {
    const reporterId = "11111111-1111-1111-1111-111111111111";
    const profileId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    assert.throws(() =>
      validateReportForUser(
        {
          targetType: "profile",
          targetId: profileId,
          reason: "spam",
        },
        reporterId,
        profileId,
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
