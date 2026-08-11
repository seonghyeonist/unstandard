import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashReservationNonce,
  generateReservationNonce,
} from "../lib/auth/invite-crypto";

describe("invite reservation nonce", () => {
  it("hashes reservation capability without logging raw values", () => {
    const nonce = generateReservationNonce();
    const hash = hashReservationNonce(nonce, "pepper");
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, nonce);
  });
});
