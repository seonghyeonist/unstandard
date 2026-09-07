import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

describe("operator invite boundary", () => {
  it("uses a dedicated server-only operator credential and an HttpOnly session", () => {
    const auth = source("lib/alpha/operator-auth.ts");
    assert.match(auth, /UNSTANDARD_INVITE_OPERATOR_TOKEN/);
    assert.match(auth, /httpOnly:\s*true/);
    assert.match(auth, /sameSite:\s*"strict"/);
    assert.doesNotMatch(auth, /localStorage|sessionStorage/);
  });

  it("protects every mutable operator route server-side", () => {
    for (const path of [
      "app/api/alpha/operator/login/route.ts",
      "app/api/alpha/operator/logout/route.ts",
      "app/api/alpha/operator/invites/route.ts",
      "app/api/alpha/operator/invites/[inviteId]/revoke/route.ts",
      "app/api/alpha/operator/invites/[inviteId]/reissue/route.ts",
    ]) {
      const value = source(path);
      assert.match(value, /isSameOriginMutation/);
    }
    for (const path of [
      "app/api/alpha/operator/logout/route.ts",
      "app/api/alpha/operator/invites/route.ts",
      "app/api/alpha/operator/invites/[inviteId]/revoke/route.ts",
      "app/api/alpha/operator/invites/[inviteId]/reissue/route.ts",
    ]) {
      assert.match(source(path), /hasOperatorSession/);
    }
  });

  it("keeps raw invite capabilities out of the status list", () => {
    const admin = source("lib/alpha/invite-admin.ts");
    const summary = admin.slice(admin.indexOf("export async function listStage1Invites"), admin.indexOf("export async function revokeStage1Invite"));
    assert.match(summary, /emailMasked/);
    assert.doesNotMatch(summary, /rawCode|codeHash/);
  });
});
