import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAuthorizedDebugRequest } from "../app/api/debug/auth-env/route.ts";
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
  "UNSTANDARD_DEBUG_CHECK_TOKEN",
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
  return new Request(`https://${host}/api/debug/auth-env`, {
    headers: {
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": "https",
    },
  });
}

describe("buildAuthEnvDiagnostics", () => {
  it("authorizes only the Bearer header and never a query-string token", () => {
    withEnv({ UNSTANDARD_DEBUG_CHECK_TOKEN: "debug-token" }, () => {
      const authorized = new Request("https://preview.example.com/api/debug/auth-env", {
        headers: { Authorization: "Bearer debug-token" },
      });
      const queryToken = new Request(
        "https://preview.example.com/api/debug/auth-env?token=debug-token",
      );

      assert.equal(isAuthorizedDebugRequest(authorized), true);
      assert.equal(isAuthorizedDebugRequest(queryToken), false);
    });
  });

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
