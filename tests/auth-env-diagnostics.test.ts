import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAuthEnvDiagnostics } from "../lib/debug/auth-env-diagnostics.ts";

const ENV_KEYS = [
  "UNSTANDARD_SUPABASE_URL",
  "UNSTANDARD_SUPABASE_PUBLISHABLE_KEY",
  "AUTH_COOKIE_SECRET",
  "UNSTANDARD_APP_URL",
  "REPORTS_PERSISTENCE_ADAPTER",
  "NODE_ENV",
  "VERCEL_ENV",
] as const;

function snapshotEnv(): Record<(typeof ENV_KEYS)[number], string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
    (typeof ENV_KEYS)[number],
    string | undefined
  >;
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

function makeRequest(host = "preview.example.com"): Request {
  return new Request(`https://${host}/api/debug/auth-env?token=test`, {
    headers: {
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": "https",
    },
  });
}

describe("buildAuthEnvDiagnostics", () => {
  it("returns ok=true when required staging env is present", () => {
    withEnv(
      {
        UNSTANDARD_SUPABASE_URL: "https://staging.supabase.co",
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        AUTH_COOKIE_SECRET: "cookie-secret",
        UNSTANDARD_APP_URL: "https://preview.example.com",
        REPORTS_PERSISTENCE_ADAPTER: "disabled",
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
      },
      () => {
        const result = buildAuthEnvDiagnostics(makeRequest());

        assert.equal(result.ok, true);
        assert.equal(result.env.nodeEnv, "production");
        assert.equal(result.env.vercelEnv, "preview");
        assert.equal(result.request.host, "preview.example.com");
        assert.equal(result.auth.hasUnstandardSupabaseUrl, true);
        assert.equal(result.auth.hasUnstandardSupabasePublishableKey, true);
        assert.equal(result.auth.hasAuthCookieSecret, true);
        assert.equal(result.auth.hasUnstandardAppUrl, true);
        assert.equal(result.auth.isServerSupabaseConfigured, true);
        assert.equal(result.reports.hasReportsPersistenceAdapter, true);
        assert.equal(result.reports.reportsPersistenceAdapterIsDisabled, true);
      },
    );
  });

  it("returns ok=false when a required env var is missing", () => {
    withEnv(
      {
        UNSTANDARD_SUPABASE_URL: "https://staging.supabase.co",
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        AUTH_COOKIE_SECRET: undefined,
        UNSTANDARD_APP_URL: "https://preview.example.com",
        REPORTS_PERSISTENCE_ADAPTER: "disabled",
      },
      () => {
        const result = buildAuthEnvDiagnostics(makeRequest());

        assert.equal(result.ok, false);
        assert.equal(result.auth.hasAuthCookieSecret, false);
      },
    );
  });

  it("returns ok=false when reports persistence is enabled", () => {
    withEnv(
      {
        UNSTANDARD_SUPABASE_URL: "https://staging.supabase.co",
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        AUTH_COOKIE_SECRET: "cookie-secret",
        UNSTANDARD_APP_URL: "https://preview.example.com",
        REPORTS_PERSISTENCE_ADAPTER: "supabase-alpha",
      },
      () => {
        const result = buildAuthEnvDiagnostics(makeRequest());

        assert.equal(result.ok, false);
        assert.equal(result.reports.reportsPersistenceAdapterIsDisabled, false);
      },
    );
  });

  it("treats unset reports adapter as disabled for ok", () => {
    withEnv(
      {
        UNSTANDARD_SUPABASE_URL: "https://staging.supabase.co",
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        AUTH_COOKIE_SECRET: "cookie-secret",
        UNSTANDARD_APP_URL: "https://preview.example.com",
        REPORTS_PERSISTENCE_ADAPTER: undefined,
      },
      () => {
        const result = buildAuthEnvDiagnostics(makeRequest());

        assert.equal(result.ok, true);
        assert.equal(result.reports.reportsPersistenceAdapterIsDisabled, true);
        assert.equal(result.reports.hasReportsPersistenceAdapter, false);
      },
    );
  });
});
