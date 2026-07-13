import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertTestDatabaseEnv } from "../../lib/config/database-env.ts";

describe("integration gate", () => {
  it("fails fast when TEST_DATABASE_URL is missing", () => {
    const original = process.env.TEST_DATABASE_URL;
    delete process.env.TEST_DATABASE_URL;
    try {
      assert.throws(() => {
        if (!process.env.TEST_DATABASE_URL?.trim()) {
          throw new Error("TEST_DATABASE_URL is required");
        }
      });
    } finally {
      if (original) process.env.TEST_DATABASE_URL = original;
    }
  });

  it("requires DATABASE_ENV=test for destructive tests", () => {
    const original = process.env.DATABASE_ENV;
    process.env.DATABASE_ENV = "staging";
    try {
      assert.throws(() => assertTestDatabaseEnv());
    } finally {
      if (original) process.env.DATABASE_ENV = original;
      else delete process.env.DATABASE_ENV;
    }
  });
});
