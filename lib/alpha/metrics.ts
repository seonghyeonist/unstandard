import { createHash } from "node:crypto";
import { ALPHA_RECRUITMENT_COHORTS } from "@/lib/alpha/stage1-policy";

export const ALPHA_METRICS_CONTRACT_VERSION = "alpha-stage1-kpi-v1" as const;
export const ALPHA_METRIC_MIN_SAMPLE = 10;
export const ALPHA_GROUP_MIN_SAMPLE = 5;

export type MetricStatus = "PASS" | "FAIL" | "INSUFFICIENT_DATA" | "NOT_IMPLEMENTED";

export type AlphaMetric = {
  name: string;
  status: MetricStatus;
  numerator: number | null;
  denominator: number;
  value: number | null;
  threshold: number;
  comparator: ">=" | "<=";
  unit: "ratio" | "seconds" | "characters";
  minimumSample: number;
};

export type AlphaGroupMetric = AlphaMetric & { key: string };

function finiteOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

export function evaluateMetric(input: {
  name: string;
  numerator?: number | null;
  denominator: number;
  value: number | null;
  threshold: number;
  comparator: ">=" | "<=";
  unit: AlphaMetric["unit"];
  minimumSample?: number;
}): AlphaMetric {
  const minimumSample = input.minimumSample ?? ALPHA_METRIC_MIN_SAMPLE;
  const value = finiteOrNull(input.value);
  let status: MetricStatus = "INSUFFICIENT_DATA";
  if (Number.isInteger(input.denominator) && input.denominator >= minimumSample && value !== null) {
    status = input.comparator === ">="
      ? value >= input.threshold ? "PASS" : "FAIL"
      : value <= input.threshold ? "PASS" : "FAIL";
  }
  return {
    name: input.name,
    status,
    numerator: finiteOrNull(input.numerator ?? null),
    denominator: input.denominator,
    value,
    threshold: input.threshold,
    comparator: input.comparator,
    unit: input.unit,
    minimumSample,
  };
}

export function ratioMetric(input: {
  name: string;
  numerator: number;
  denominator: number;
  threshold: number;
  minimumSample?: number;
}): AlphaMetric {
  return evaluateMetric({
    ...input,
    value: input.denominator > 0 ? input.numerator / input.denominator : null,
    comparator: ">=",
    unit: "ratio",
  });
}

export type FounderExperimentDecision =
  | "GO"
  | "CONDITIONAL_GO"
  | "COLLECTING"
  | "NO_GO_OR_REDESIGN";

export function evaluateFounderExperimentDecision(input: {
  productLowerBounds: AlphaMetric[];
  channelD7: AlphaGroupMetric[];
  waitlistRevisit: AlphaMetric;
  onboarding: AlphaMetric;
  questionResponse: AlphaMetric;
  balanceMaintenance: AlphaMetric;
  cohortD7: AlphaGroupMetric[];
}): { decision: FounderExperimentDecision; reasons: string[]; productPassCount: number } {
  const productPassCount = input.productLowerBounds.filter((metric) => metric.status === "PASS").length;
  const reasons: string[] = [];
  const channelPass = input.channelD7.some((metric) => metric.status === "PASS");
  const targetCohorts = new Map(
    input.cohortD7
      .filter((metric) => (ALPHA_RECRUITMENT_COHORTS as readonly string[]).includes(metric.key))
      .map((metric) => [metric.key, metric]),
  );
  const allCohortsMature = ALPHA_RECRUITMENT_COHORTS.every(
    (key) => targetCohorts.get(key)?.status !== undefined &&
      targetCohorts.get(key)?.status !== "INSUFFICIENT_DATA",
  );
  const qualityCohort = ALPHA_RECRUITMENT_COHORTS.some(
    (key) => targetCohorts.get(key)?.status === "PASS",
  );
  const stopSignalCount = [
    input.onboarding,
    input.questionResponse,
    input.balanceMaintenance,
  ].filter((metric) => metric.status === "FAIL").length;

  if (stopSignalCount >= 2) reasons.push("two_or_more_core_stop_signals_failed");
  if (allCohortsMature && !qualityCohort) reasons.push("no_quality_cohort_after_mature_observation");
  if (reasons.length > 0) {
    return { decision: "NO_GO_OR_REDESIGN", reasons, productPassCount };
  }

  if (productPassCount >= 3 && channelPass && input.waitlistRevisit.status === "PASS") {
    return { decision: "GO", reasons: ["v4_2_go_rule_satisfied"], productPassCount };
  }

  const anyImmature = [
    ...input.productLowerBounds,
    ...input.channelD7,
    input.waitlistRevisit,
    input.balanceMaintenance,
  ].some((metric) => metric.status === "INSUFFICIENT_DATA");
  if (productPassCount >= 3) {
    if (!channelPass) reasons.push("no_main_channel_d7_pass");
    if (input.waitlistRevisit.status !== "PASS") reasons.push("waitlist_revisit_not_passed");
    if (input.balanceMaintenance.status !== "PASS") reasons.push("supply_balance_unstable_or_immature");
    return { decision: "CONDITIONAL_GO", reasons, productPassCount };
  }
  if (anyImmature) {
    return { decision: "COLLECTING", reasons: ["minimum_observation_not_reached"], productPassCount };
  }
  return {
    decision: "CONDITIONAL_GO",
    reasons: ["product_lower_bound_pass_count_below_three"],
    productPassCount,
  };
}

export function withMetricsDigest<T extends Record<string, unknown>>(base: T): T & {
  contentDigest: string;
} {
  return {
    ...base,
    contentDigest: createHash("sha256").update(JSON.stringify(base)).digest("hex"),
  };
}
