import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAuthEnvDiagnostics } from "../lib/debug/auth-env-diagnostics.ts";

const ENV_KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "AUTH_COOKIE_SECRET",
  "UNSTANDARD_APP_URL",
  "UNSTANDARD_RUNTIME_MODE",
  "DATABASE_ENV",
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
  it("returns ok=true when required database auth env is present", () => {
    withEnv(
      {
        DATABASE_URL: "postgres://staging",
        BETTER_AUTH_SECRET: "x".repeat(32),
        BETTER_AUTH_URL: "https://preview.example.com",
        AUTH_COOKIE_SECRET: "cookie-secret",
        UNSTANDARD_APP_URL: "https://preview.example.com",
        UNSTANDARD_RUNTIME_MODE: "database",
        DATABASE_ENV: "staging",
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
      },
      () => {
        const result = buildAuthEnvDiagnostics(makeRequest());

        assert.equal(result.ok, true);
        assert.equal(result.env.vercelEnv, "preview");
        assert.equal(result.auth.hasDatabaseUrl, true);
        assert.equal(result.auth.isDatabaseAuthConfigured, true);
      },
    );
  });

  it("returns ok=false when a required env var is missing", () => {
    withEnv(
      {
        DATABASE_URL: "postgres://staging",
        BETTER_AUTH_SECRET: "x".repeat(32),
        BETTER_AUTH_URL: "https://preview.example.com",
        AUTH_COOKIE_SECRET: undefined,
        UNSTANDARD_APP_URL: "https://preview.example.com",
        UNSTANDARD_RUNTIME_MODE: "database",
      },
      () => {
        const result = buildAuthEnvDiagnostics(makeRequest());
        assert.equal(result.ok, false);
        assert.equal(result.auth.hasAuthCookieSecret, false);
      },
    );
  });
});
