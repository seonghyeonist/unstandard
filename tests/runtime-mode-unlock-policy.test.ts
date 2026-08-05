import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRuntimeMode, isDatabaseRuntime } from "../lib/config/runtime-mode.ts";

const ENV_KEYS = ["UNSTANDARD_RUNTIME_MODE", "VERCEL_ENV", "NODE_ENV"] as const;

function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  run: () => void,
): void {
  const snapshot = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
    (typeof ENV_KEYS)[number],
    string | undefined
  >;
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
    for (const key of ENV_KEYS) {
      const value = snapshot[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("runtime mode unlock policy", () => {
  it("defaults to mock locally", () => {
    withEnv(
      { UNSTANDARD_RUNTIME_MODE: undefined, VERCEL_ENV: undefined, NODE_ENV: "development" },
      () => {
        assert.equal(getRuntimeMode(), "mock");
        assert.equal(isDatabaseRuntime(), false);
      },
    );
  });

  it("defaults to database when VERCEL_ENV is set", () => {
    withEnv(
      { UNSTANDARD_RUNTIME_MODE: undefined, VERCEL_ENV: "preview", NODE_ENV: "production" },
      () => {
        assert.equal(getRuntimeMode(), "database");
      },
    );
  });

  it("honors explicit database mode", () => {
    withEnv(
      { UNSTANDARD_RUNTIME_MODE: "database", VERCEL_ENV: undefined, NODE_ENV: "development" },
      () => {
        assert.equal(getRuntimeMode(), "database");
      },
    );
  });

  it("documents explicit mock precedence over VERCEL_ENV (not an accepted Preview bypass)", () => {
    withEnv(
      { UNSTANDARD_RUNTIME_MODE: "mock", VERCEL_ENV: "preview", NODE_ENV: "production" },
      () => {
        assert.equal(getRuntimeMode(), "mock");
      },
    );
  });
});
