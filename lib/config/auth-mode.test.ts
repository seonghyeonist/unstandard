import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMockAuthAllowed } from "../config/auth-mode.ts";

describe("auth-mode server", () => {
  it("disallows mock auth in production", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.equal(isMockAuthAllowed(), false);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
