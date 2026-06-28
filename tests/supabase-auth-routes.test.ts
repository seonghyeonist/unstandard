import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveOAuthProvider } from "../lib/auth/supabase-oauth.ts";
import { isServerSupabaseConfigured } from "../lib/config/supabase-config.ts";

describe("resolveOAuthProvider", () => {
  it("accepts configured provider", () => {
    assert.equal(resolveOAuthProvider(null, "github"), "github");
  });

  it("rejects unknown provider", () => {
    assert.equal(resolveOAuthProvider("twitter", "github"), null);
  });
});

describe("supabase auth route fail-closed config", () => {
  it("is not configured when env is missing", () => {
    const originalUrl = process.env.UNSTANDARD_SUPABASE_URL;
    const originalKey = process.env.UNSTANDARD_SUPABASE_PUBLISHABLE_KEY;
    const legacyUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const legacyKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    delete process.env.UNSTANDARD_SUPABASE_URL;
    delete process.env.UNSTANDARD_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      assert.equal(isServerSupabaseConfigured(), false);
    } finally {
      if (originalUrl === undefined) delete process.env.UNSTANDARD_SUPABASE_URL;
      else process.env.UNSTANDARD_SUPABASE_URL = originalUrl;
      if (originalKey === undefined) delete process.env.UNSTANDARD_SUPABASE_PUBLISHABLE_KEY;
      else process.env.UNSTANDARD_SUPABASE_PUBLISHABLE_KEY = originalKey;
      if (legacyUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = legacyUrl;
      if (legacyKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = legacyKey;
    }
  });
});
