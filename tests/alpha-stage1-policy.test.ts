import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALPHA_STAGE_1_CAP,
  ALPHA_STAGE_1_MAX_DAYS,
  evaluateBalanceGate,
} from "../lib/alpha/stage1-policy";

describe("alpha Stage 1 policy", () => {
  it("fixes the founder-approved cap and maximum observation window", () => {
    assert.equal(ALPHA_STAGE_1_CAP, 50);
    assert.equal(ALPHA_STAGE_1_MAX_DAYS, 42);
  });

  it("implements the v4.2 balance boundaries exactly", () => {
    assert.equal(evaluateBalanceGate(6, 4).gate, "OPEN");
    assert.equal(evaluateBalanceGate(7, 4).gate, "BOOST_MINORITY");
    assert.equal(evaluateBalanceGate(65, 35).gate, "SOFT_WAITLIST");
    assert.equal(evaluateBalanceGate(7, 3).gate, "HARD_GATE");
    assert.equal(evaluateBalanceGate(3, 7).minorityBucket, "bucket_a");
  });

  it("rejects invalid counts instead of manufacturing a ratio", () => {
    assert.throws(() => evaluateBalanceGate(-1, 2));
    assert.throws(() => evaluateBalanceGate(1.5, 2));
  });
});
