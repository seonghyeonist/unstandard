import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAcceptableNewPassword } from "./password-policy";

describe("new password policy", () => {
  it("accepts long non-common passwords and rejects weak patterns", () => {
    assert.equal(isAcceptableNewPassword("a-secure-password-2026"), true);
    assert.equal(isAcceptableNewPassword("password123"), false);
    assert.equal(isAcceptableNewPassword("aaaaaaaaaa"), false);
    assert.equal(isAcceptableNewPassword("1234567890"), false);
    assert.equal(isAcceptableNewPassword("short"), false);
    assert.equal(isAcceptableNewPassword("x".repeat(129)), false);
  });
});
