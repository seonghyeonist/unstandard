import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMockAuthAllowed, isSupabaseAuthEnabled } from "../lib/config/auth-mode.ts";
import { validateReportInput } from "../lib/security/report-validation.ts";
import {
  resolveCookieSecret,
  signUnlockToken,
  verifyUnlockToken,
} from "../lib/server/unlock-signature.ts";

describe("auth-boundary", () => {
  it("blocks mock auth in production", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.equal(isMockAuthAllowed(), false);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it("production without Supabase env is not auth-configured", () => {
    const originalNode = process.env.NODE_ENV;
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      assert.equal(isSupabaseAuthEnabled(), false);
      assert.equal(process.env.NODE_ENV === "production" && !isSupabaseAuthEnabled(), true);
    } finally {
      process.env.NODE_ENV = originalNode;
      if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  });

  it("throws when AUTH_COOKIE_SECRET is missing in production", () => {
    assert.throws(
      () => resolveCookieSecret("production", undefined),
      /AUTH_COOKIE_SECRET is required in production/,
    );
  });

  it("unlock signature rejects wrong viewer for same profile", () => {
    const secret = "test-secret";
    const token = signUnlockToken("c1", "user-a", secret);
    assert.equal(verifyUnlockToken("c1", "user-a", token, secret), true);
    assert.equal(verifyUnlockToken("c1", "user-b", token, secret), false);
    assert.equal(verifyUnlockToken("c2", "user-a", token, secret), false);
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

  it("rejects invalid report targetType", () => {
    assert.throws(() =>
      validateReportInput({ targetType: "admin", targetId: "c1", reason: "spam" }),
    );
  });
});
