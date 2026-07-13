import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateInviteCode,
  hashInviteCode,
  normalizeEmail,
} from "./invite-crypto.ts";
import {
  createRegistrationTicket,
  verifyRegistrationTicket,
} from "./invite-ticket.ts";

describe("invite-crypto", () => {
  it("normalizes email", () => {
    assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
  });

  it("hashes invite codes deterministically", () => {
    const a = hashInviteCode("code-1", "pepper");
    const b = hashInviteCode("code-1", "pepper");
    const c = hashInviteCode("code-2", "pepper");
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it("generates sufficiently long invite codes", () => {
    assert.ok(generateInviteCode().length >= 16);
  });
});

describe("invite-ticket", () => {
  it("signs and verifies registration tickets", () => {
    const secret = "x".repeat(32);
    const { token } = createRegistrationTicket("invite-id", "user@example.com", secret);
    const verified = verifyRegistrationTicket(token, secret);
    assert.equal(verified?.inviteId, "invite-id");
    assert.equal(verified?.email, "user@example.com");
  });
});
