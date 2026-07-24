import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDatabaseAuthConfigured,
  isMockAuthAllowed,
  getRuntimeMode,
} from "../lib/config/runtime-mode.ts";
import { validateReportInput } from "../lib/security/report-validation.ts";
import {
  resolveCookieSecret,
  signUnlockToken,
  verifyUnlockToken,
} from "../lib/server/unlock-signature.ts";

const ENV_KEYS = [
  "UNSTANDARD_RUNTIME_MODE",
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
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
  Object.assign(process.env, overrides);
  for (const key of ENV_KEYS) {
    if (!(key in overrides)) continue;
    const value = overrides[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    restoreEnv(snapshot);
  }
}

describe("auth-boundary", () => {
  it("blocks mock auth in production", () => {
    withEnv({ NODE_ENV: "production", VERCEL_ENV: undefined, UNSTANDARD_RUNTIME_MODE: "mock" }, () => {
      assert.equal(isMockAuthAllowed(), false);
    });
  });

  it("requires database env for database auth", () => {
    withEnv(
      {
        UNSTANDARD_RUNTIME_MODE: "database",
        DATABASE_URL: undefined,
        BETTER_AUTH_SECRET: "x".repeat(32),
        BETTER_AUTH_URL: "http://localhost:3000",
      },
      () => {
        assert.equal(isDatabaseAuthConfigured(), false);
      },
    );
  });

  it("defaults development to mock runtime", () => {
    withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        UNSTANDARD_RUNTIME_MODE: undefined,
      },
      () => {
        assert.equal(getRuntimeMode(), "mock");
      },
    );
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
});
