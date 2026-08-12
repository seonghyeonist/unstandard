import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateMessageBody } from "../lib/security/message-validation";

describe("message validation", () => {
  it("trims and accepts a bounded message", () => {
    assert.equal(validateMessageBody("  hello  "), "hello");
  });

  it("rejects empty, non-string, and oversized input", () => {
    assert.throws(() => validateMessageBody("   "));
    assert.throws(() => validateMessageBody(null));
    assert.throws(() => validateMessageBody("x".repeat(501)));
  });
});
