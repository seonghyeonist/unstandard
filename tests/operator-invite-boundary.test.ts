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

  it("rate-limits operator credential attempts and fails closed if limiter storage is unavailable", () => {
    const login = source("app/api/alpha/operator/login/route.ts");
    const policy = source("lib/security/rate-limit-policy.ts");
    assert.match(login, /consumeRateLimit/);
    assert.match(login, /scope:\s*"operatorLogin"/);
    assert.match(login, /RateLimitUnavailableError/);
    assert.match(login, /status:\s*429/);
    assert.match(login, /status:\s*503/);
    assert.match(policy, /operatorLogin:\s*\{\s*limit:\s*10,\s*windowMs:\s*15\s*\*\s*60\s*\*\s*1_000\s*\}/);
  });

  it("keeps raw invite capabilities out of the status list", () => {
    const admin = source("lib/alpha/invite-admin.ts");
    const summary = admin.slice(admin.indexOf("export async function listStage1Invites"), admin.indexOf("export async function revokeStage1Invite"));
    assert.match(summary, /emailMasked/);
    assert.doesNotMatch(summary, /rawCode|codeHash/);
  });

  it("does not issue a new-user invite to an existing local identity and always uses the canonical link origin", () => {
    const admin = source("lib/alpha/invite-admin.ts");
    assert.match(admin, /EMAIL_ALREADY_REGISTERED/);
    assert.match(admin, /leftJoin\(accounts, eq\(accounts\.userId, users\.id\)\)/);
    for (const path of [
      "app/api/alpha/operator/invites/route.ts",
      "app/api/alpha/operator/invites/[inviteId]/reissue/route.ts",
    ]) {
      const route = source(path);
      assert.match(route, /buildInviteLink\(created\.rawCode\)/);
      assert.doesNotMatch(route, /new URL\(request\.url\)\.origin/);
    }
  });

  it("shows time-expired invites as expired and permits direct reissue without a manual revoke", () => {
    const admin = source("lib/alpha/invite-admin.ts");
    assert.match(admin, /effectiveInviteStatus/);
    assert.match(admin, /\["pending", "reserved"\]\.includes\(status\) && expiresAt <= now \? "expired" : status/);
    const reissue = admin.slice(admin.indexOf("export async function reissueStage1Invite"));
    assert.match(reissue, /inArray\(alphaInvites\.status, \["pending", "reserved"\]\)/);
    assert.match(reissue, /alphaInvites\.expiresAt\} <= \$\{now\}/);
    assert.match(reissue, /status: "expired"/);
  });

  it("describes new signup using the personal invite-link UX, not the removed invite-code form", () => {
    const login = source("app/login/login-client.tsx");
    assert.match(login, /개인 초대 링크/);
    assert.doesNotMatch(login, /초대코드가 있는 등록 화면/);
  });
});
