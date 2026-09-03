import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { getSocialProviderAvailabilityFromEnv } from "../lib/auth/social-config-policy";
import { oauthInviteEmailMatches, oauthInviteRegistrationAllowed } from "../lib/auth/oauth-invite";

describe("closed-alpha OAuth invite gate", () => {
  it("matches provider email to the reserved invite case-insensitively", () => {
    assert.equal(oauthInviteEmailMatches("  Member@Example.com ", "member@example.com"), true);
    assert.equal(oauthInviteEmailMatches("member@example.com", "other@example.com"), false);
  });

  it("rejects missing email values instead of treating an empty match as valid", () => {
    assert.equal(oauthInviteEmailMatches("", "member@example.com"), false);
    assert.equal(oauthInviteEmailMatches("member@example.com", ""), false);
    assert.equal(oauthInviteEmailMatches("   ", "   "), false);
  });

  it("requires a valid reservation in addition to a matching provider email", () => {
    assert.equal(oauthInviteRegistrationAllowed({ oauthEmail: "member@example.com", inviteEmail: "member@example.com", reservationValid: true }), true);
    assert.equal(oauthInviteRegistrationAllowed({ oauthEmail: "member@example.com", inviteEmail: "member@example.com", reservationValid: false }), false);
    assert.equal(oauthInviteRegistrationAllowed({ oauthEmail: "member@example.com", inviteEmail: undefined, reservationValid: true }), false);
  });

  it("reports Google and Naver availability only for complete clean credentials", () => {
    assert.deepEqual(getSocialProviderAvailabilityFromEnv({
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      NAVER_CLIENT_ID: "naver-id",
      NAVER_CLIENT_SECRET: "naver-secret",
    }), { google: true, naver: true });
    assert.deepEqual(getSocialProviderAvailabilityFromEnv({
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "",
      NAVER_CLIENT_ID: "naver-id",
      NAVER_CLIENT_SECRET: "naver-secret\nforbidden",
    }), { google: false, naver: false });
  });

  it("keeps implicit signup and account linking disabled in the server contract", () => {
    const source = readFileSync("lib/auth/auth.ts", "utf8");
    assert.match(source, /disableImplicitSignUp:\s*true/);
    assert.match(source, /accountLinking:\s*\{[\s\S]*enabled:\s*false/);
    assert.match(source, /disableImplicitLinking:\s*true/);
    assert.match(source, /oauthInviteRegistrationAllowed/);
    assert.match(source, /verifyInviteReservation/);
    assert.match(source, /finalizeInviteRegistration/);
    assert.match(source, /clearRegistrationTicketCookie/);
    assert.match(source, /genericOAuth\(\{ config: naverOAuthConfig\(\) \}\)/);
  });

  it("does not place OAuth or Didit secrets in client entrypoints", () => {
    for (const path of [
      "lib/auth/client.ts",
      "app/login/login-client.tsx",
      "components/auth/register-form.tsx",
    ]) {
      const source = readFileSync(path, "utf8");
      assert.doesNotMatch(source, /CLIENT_SECRET|DIDIT_API_KEY|WEBHOOK_SECRET/);
    }
  });
});
