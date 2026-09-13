import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateEmailVerificationCode,
  hashEmailVerificationCode,
  isValidEmailVerificationCode,
  safeEqualHex,
} from "./email-verification-crypto";

describe("email verification crypto", () => {
  it("generates six-digit codes and rejects malformed input", () => {
    const code = generateEmailVerificationCode();
    assert.match(code, /^\d{6}$/);
    assert.equal(isValidEmailVerificationCode(code), true);
    assert.equal(isValidEmailVerificationCode("12345"), false);
    assert.equal(isValidEmailVerificationCode("1234567"), false);
    assert.equal(isValidEmailVerificationCode("abcdef"), false);
  });

  it("uses a server-keyed, challenge-bound MAC", () => {
    const a = hashEmailVerificationCode("challenge-a", "Member@Example.com", "123456", "secret");
    const b = hashEmailVerificationCode("challenge-b", "member@example.com", "123456", "secret");
    const c = hashEmailVerificationCode("challenge-a", "member@example.com", "123457", "secret");
    assert.equal(a, hashEmailVerificationCode("challenge-a", "member@example.com", "123456", "secret"));
    assert.notEqual(a, b);
    assert.notEqual(a, c);
    assert.equal(safeEqualHex(a, a), true);
    assert.equal(safeEqualHex(a, c), false);
  });
});
