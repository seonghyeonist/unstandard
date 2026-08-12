import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateFounderExperimentDecision,
  evaluateMetric,
  ratioMetric,
  type AlphaGroupMetric,
  type AlphaMetric,
} from "../lib/alpha/metrics";

function pass(name: string): AlphaMetric {
  return ratioMetric({ name, numerator: 9, denominator: 10, threshold: 0.5 });
}

function fail(name: string): AlphaMetric {
  return ratioMetric({ name, numerator: 1, denominator: 10, threshold: 0.5 });
}

function group(key: string, numerator: number): AlphaGroupMetric {
  return {
    key,
    ...ratioMetric({
      name: "group_d7",
      numerator,
      denominator: 5,
      threshold: 0.45,
      minimumSample: 5,
    }),
  };
}

describe("alpha metric semantics", () => {
  it("does not turn a tiny perfect sample into PASS", () => {
    const metric = ratioMetric({
      name: "onboarding",
      numerator: 1,
      denominator: 1,
      threshold: 0.75,
    });
    assert.equal(metric.value, 1);
    assert.equal(metric.status, "INSUFFICIENT_DATA");
  });

  it("evaluates lower-is-better medians at the boundary", () => {
    assert.equal(
      evaluateMetric({
        name: "first_blur",
        denominator: 10,
        value: 180,
        threshold: 180,
        comparator: "<=",
        unit: "seconds",
      }).status,
      "PASS",
    );
  });

  it("returns GO only when all compound founder conditions are present", () => {
    const product = [pass("a"), pass("b"), pass("c"), fail("d")];
    const result = evaluateFounderExperimentDecision({
      productLowerBounds: product,
      channelD7: [group("organic", 3)],
      waitlistRevisit: pass("waitlist"),
      onboarding: product[0],
      questionResponse: product[1],
      balanceMaintenance: pass("balance"),
      cohortD7: [group("a", 3)],
    });
    assert.equal(result.decision, "GO");
    assert.equal(result.productPassCount, 3);
  });

  it("returns No-Go before vanity metrics can override two mature stop signals", () => {
    const result = evaluateFounderExperimentDecision({
      productLowerBounds: [fail("onboarding"), pass("blur"), fail("response"), pass("message")],
      channelD7: [group("organic", 5)],
      waitlistRevisit: pass("waitlist"),
      onboarding: fail("onboarding"),
      questionResponse: fail("response"),
      balanceMaintenance: pass("balance"),
      cohortD7: [group("a", 5)],
    });
    assert.equal(result.decision, "NO_GO_OR_REDESIGN");
    assert.ok(result.reasons.includes("two_or_more_core_stop_signals_failed"));
  });

  it("does not let legacy cohort rows spoof five-cohort maturity or quality", () => {
    const failedTargets = [
      "founder_network",
      "writing_reading",
      "subculture_meme",
      "dating_app_fatigue",
      "quiet_introvert",
    ].map((key) => group(key, 0));
    const result = evaluateFounderExperimentDecision({
      productLowerBounds: [pass("onboarding"), pass("blur"), pass("response"), pass("message")],
      channelD7: [group("organic", 3)],
      waitlistRevisit: pass("waitlist"),
      onboarding: pass("onboarding"),
      questionResponse: pass("response"),
      balanceMaintenance: pass("balance"),
      cohortD7: [...failedTargets, group("legacy_unassigned", 5)],
    });
    assert.equal(result.decision, "NO_GO_OR_REDESIGN");
    assert.ok(result.reasons.includes("no_quality_cohort_after_mature_observation"));
  });
});
