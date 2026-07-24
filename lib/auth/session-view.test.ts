import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPublicSessionUser } from "./session-view.ts";

describe("toPublicSessionUser", () => {
  it("redacts sensitive fields and exposes safe nickname", () => {
    const view = toPublicSessionUser({
      id: "11111111-1111-1111-1111-111111111111",
      email: "hidden@example.com",
    });
    assert.equal(view.nickname, "user-11111111");
    assert.equal(view.idPrefix, "11111111");
    assert.equal(view.onboarded, false);
    assert.equal("id" in view, false);
    assert.equal("email" in view, false);
  });

  it("keeps onboarded false when not onboarded", () => {
    const view = toPublicSessionUser({
      id: "mock-id",
      nickname: "손님",
      onboarded: false,
    });
    assert.equal(view.onboarded, false);
    assert.equal(view.nickname, "손님");
    assert.equal("id" in view, false);
  });
});
