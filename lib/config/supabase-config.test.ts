import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getServerSupabaseConfig,
  isServerSupabaseConfigured,
  requireServerSupabaseConfig,
} from "./supabase-config.ts";

const ENV_KEYS = [
  "UNSTANDARD_SUPABASE_URL",
  "UNSTANDARD_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

function snapshotEnv(): Record<(typeof ENV_KEYS)[number], string | undefined> {
  return {
    UNSTANDARD_SUPABASE_URL: process.env.UNSTANDARD_SUPABASE_URL,
    UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: process.env.UNSTANDARD_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function restoreEnv(snapshot: Record<(typeof ENV_KEYS)[number], string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  run: () => void,
): void {
  const snapshot = snapshotEnv();
  for (const key of ENV_KEYS) {
    if (key in overrides) {
      const value = overrides[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  try {
    run();
  } finally {
    restoreEnv(snapshot);
  }
}

describe("getServerSupabaseConfig", () => {
  it("prefers UNSTANDARD_* over legacy NEXT_PUBLIC_*", () => {
    withEnv(
      {
        UNSTANDARD_SUPABASE_URL: "https://staging.supabase.co",
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        NEXT_PUBLIC_SUPABASE_URL: "https://legacy.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon",
      },
      () => {
        assert.deepEqual(getServerSupabaseConfig(), {
          url: "https://staging.supabase.co",
          publishableKey: "publishable-key",
        });
      },
    );
  });

  it("falls back to legacy NEXT_PUBLIC_* when UNSTANDARD_* missing", () => {
    withEnv(
      {
        UNSTANDARD_SUPABASE_URL: undefined,
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: undefined,
        NEXT_PUBLIC_SUPABASE_URL: "https://legacy.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon",
      },
      () => {
        assert.deepEqual(getServerSupabaseConfig(), {
          url: "https://legacy.supabase.co",
          publishableKey: "legacy-anon",
        });
      },
    );
  });

  it("returns missing state when env is absent", () => {
    withEnv(
      {
        UNSTANDARD_SUPABASE_URL: undefined,
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: undefined,
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      },
      () => {
        assert.equal(isServerSupabaseConfigured(), false);
        assert.throws(() => requireServerSupabaseConfig(), /Supabase is not configured/);
      },
    );
  });

  it("does not require service role env", () => {
    withEnv(
      {
        UNSTANDARD_SUPABASE_URL: "https://staging.supabase.co",
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      },
      () => {
        assert.equal(isServerSupabaseConfigured(), true);
        assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
      },
    );
  });
});
