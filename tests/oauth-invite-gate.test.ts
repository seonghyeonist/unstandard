import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { getSocialProviderAvailabilityFromEnv } from "../lib/auth/social-config-policy";
import {
  CLOSED_ALPHA_NEW_MEMBER_PROVIDER,
  isClosedAlphaNewMemberProvider,
} from "../lib/auth/new-member-provider";
import { parseNaverProfile } from "../lib/auth/naver-profile";
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
    assert.equal(oauthInviteRegistrationAllowed({ oauthEmail: "member@example.com", inviteEmail: "member@example.com", reservationValid: true, oauthEmailVerified: true }), true);
    assert.equal(oauthInviteRegistrationAllowed({ oauthEmail: "member@example.com", inviteEmail: "member@example.com", reservationValid: false, oauthEmailVerified: true }), false);
    assert.equal(oauthInviteRegistrationAllowed({ oauthEmail: "member@example.com", inviteEmail: undefined, reservationValid: true, oauthEmailVerified: true }), false);
    assert.equal(oauthInviteRegistrationAllowed({ oauthEmail: "other@example.com", inviteEmail: "member@example.com", reservationValid: true, oauthEmailVerified: true }), false);
  });

  it("rejects an unverified or missing Google claim even with a matching reserved invite", () => {
    for (const oauthEmailVerified of [false, undefined, null, "true", "false", 1, 0]) {
      assert.equal(oauthInviteRegistrationAllowed({
        oauthEmail: "member@example.com",
        inviteEmail: "member@example.com",
        reservationValid: true,
        oauthEmailVerified,
      }), false);
    }
    const auth = readFileSync("lib/auth/auth.ts", "utf8");
    assert.match(auth, /emailVerified: profile\.email_verified === true/);
    assert.match(auth, /oauthEmailVerified: emailVerified/);
  });

  it("enforces verified Google email and invite checks in the actual user-create hook", async () => {
    let reservationValid = true;
    let ticket: { email: string } | null = { email: "member@example.com" };
    let options: Record<string, unknown> = {};
    const mocks: Record<string, unknown> = {
      "better-auth": { betterAuth: (value: Record<string, unknown>) => { options = value; return {}; } },
      "better-auth/adapters/drizzle": { drizzleAdapter: () => ({}) },
      "better-auth/next-js": { nextCookies: () => ({}) },
      "better-auth/plugins/generic-oauth": { genericOAuth: () => ({}) },
      "better-auth/api": { APIError: { from: (_status: string, body: { code: string }) => new Error(body.code) }, createAuthMiddleware: (fn: unknown) => fn },
      "next/headers": { cookies: async () => ({ get: () => ({ value: "synthetic-ticket" }) }) },
      "@/lib/db/client": { getDb: () => ({}) },
      "@/lib/auth/social-config": { getSocialProviderAvailability: () => ({ google: false, naver: false }) },
      "@/lib/auth/canonical-origin": { getCanonicalAuthOrigin: () => "https://preview.example.com" },
      "@/lib/auth/new-member-provider": { isClosedAlphaNewMemberProvider },
      "@/lib/auth/oauth-invite": { oauthInviteRegistrationAllowed },
      "@/lib/auth/invite-ticket": { getRegistrationTicketCookieName: () => "test", verifyRegistrationTicket: () => ticket },
      "@/lib/auth/invite-gate": { verifyInviteReservation: async () => reservationValid },
    };
    const exports: { getAuth?: () => unknown } = {};
    runInNewContext(ts.transpileModule(readFileSync("lib/auth/auth.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
      exports,
      require: (id: string) => mocks[id] ?? {},
      process: { env: { BETTER_AUTH_SECRET: "synthetic-test-secret" } },
    });
    exports.getAuth!();
    const hook = (options.databaseHooks as {
      user: { create: { before: (user: { email: string; emailVerified?: unknown }, context: { path: string }) => Promise<void> } };
    }).user.create.before;
    const google = { path: "/callback/google" };
    for (const emailVerified of [false, undefined, null, "true", 1]) {
      await assert.rejects(hook({ email: "member@example.com", emailVerified }, google), /INVITE_REQUIRED/);
    }
    await hook({ email: "member@example.com", emailVerified: true }, google);
    await assert.rejects(hook({ email: "other@example.com", emailVerified: true }, google), /INVITE_REQUIRED/);
    await assert.rejects(hook({ email: "member@example.com", emailVerified: true }, { path: "/oauth2/callback/naver" }), /REGISTRATION_METHOD_UNAVAILABLE/);
    reservationValid = false;
    await assert.rejects(hook({ email: "member@example.com", emailVerified: true }, google), /INVITE_REQUIRED/);
    reservationValid = true;
    ticket = null;
    await assert.rejects(hook({ email: "member@example.com", emailVerified: true }, google), /INVITE_REQUIRED/);
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

  it("accepts only a successful Naver profile and reduces it to the auth minimum", () => {
    assert.deepEqual(parseNaverProfile({
      resultcode: "00",
      message: "success",
      response: {
        id: "naver-synthetic-id",
        email: " member@example.com ",
        name: "Should Not Persist",
        mobile: "+1-202-555-0100",
        birthyear: "1990",
      },
    }), {
      id: "naver-synthetic-id",
      name: "Member",
      email: "member@example.com",
      emailVerified: false,
    });
    assert.equal(parseNaverProfile({
      resultcode: "04",
      response: { id: "naver-synthetic-id", email: "member@example.com" },
    }), null);
    assert.equal(parseNaverProfile({
      resultcode: "00",
      response: { id: "naver-synthetic-id" },
    }), null);
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
    assert.match(source, /tokenUrlParams:/);
    assert.match(source, /context\.query\?\.state/);
    assert.match(source, /parseNaverProfile/);
  });

  it("permits new members only through Google while preserving the Naver login integration", () => {
    assert.equal(CLOSED_ALPHA_NEW_MEMBER_PROVIDER, "google");
    assert.equal(isClosedAlphaNewMemberProvider("google"), true);
    assert.equal(isClosedAlphaNewMemberProvider("naver"), false);
    assert.equal(isClosedAlphaNewMemberProvider(undefined), false);

    const auth = readFileSync("lib/auth/auth.ts", "utf8");
    const register = readFileSync("components/auth/register-form.tsx", "utf8");
    const login = readFileSync("app/login/login-client.tsx", "utf8");
    assert.match(auth, /REGISTRATION_METHOD_UNAVAILABLE/);
    assert.match(auth, /isClosedAlphaNewMemberProvider\(provider\)/);
    assert.match(register, /CLOSED_ALPHA_NEW_MEMBER_PROVIDER/);
    assert.doesNotMatch(register, /\["google", "naver"\]\s+as const/);
    assert.match(login, /\["google", "naver"\]\s+as const/);
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
