import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicProfiles } from "./mock-public.ts";

describe("mock-public", () => {
  it("does not embed private profile letters in public data", () => {
    for (const profile of publicProfiles) {
      const serialized = JSON.stringify(profile);
      assert.equal("unlocked" in profile, false);
      assert.equal(serialized.includes("요즘은 빠른 확신보다"), false);
      assert.equal(serialized.includes("크게 꾸미지 않은 대화가"), false);
    }
  });
});
