export const ALPHA_STAGE_1_PHASE = "alpha_stage_1" as const;
export const LEGACY_PRE_STAGE_1_PHASE = "legacy_pre_stage1" as const;
export const ALPHA_STAGE_1_CAP = 50;
export const ALPHA_STAGE_1_MAX_DAYS = 42;

export const ALPHA_RECRUITMENT_COHORTS = [
  "founder_network",
  "writing_reading",
  "subculture_meme",
  "dating_app_fatigue",
  "quiet_introvert",
] as const;

export const ALPHA_ACQUISITION_CHANNELS = [
  "founder_direct",
  "referral",
  "writing_community",
  "subculture_community",
  "dating_fatigue_community",
  "quiet_introvert_community",
  "organic",
  "other_declared",
] as const;

/**
 * Opaque operations label. It deliberately does not encode gender or sexuality.
 * The founder defines A/B for one matching market in the restricted operations
 * record and must not mix incomparable markets in one ratio.
 */
export const ALPHA_BALANCE_BUCKETS = ["bucket_a", "bucket_b", "not_counted"] as const;

export type AlphaRecruitmentCohort = (typeof ALPHA_RECRUITMENT_COHORTS)[number];
export type AlphaAcquisitionChannel = (typeof ALPHA_ACQUISITION_CHANNELS)[number];
export type AlphaBalanceBucket = (typeof ALPHA_BALANCE_BUCKETS)[number];

export function isAlphaRecruitmentCohort(value: string): value is AlphaRecruitmentCohort {
  return (ALPHA_RECRUITMENT_COHORTS as readonly string[]).includes(value);
}

export function isAlphaAcquisitionChannel(value: string): value is AlphaAcquisitionChannel {
  return (ALPHA_ACQUISITION_CHANNELS as readonly string[]).includes(value);
}

export function isAlphaBalanceBucket(value: string): value is AlphaBalanceBucket {
  return (ALPHA_BALANCE_BUCKETS as readonly string[]).includes(value);
}

export type BalanceGate = "OPEN" | "BOOST_MINORITY" | "SOFT_WAITLIST" | "HARD_GATE";

/** v4.2 supply thresholds, evaluated only over the two founder-defined buckets. */
export function evaluateBalanceGate(bucketA: number, bucketB: number): {
  gate: BalanceGate;
  majorityShare: number | null;
  minorityBucket: "bucket_a" | "bucket_b" | null;
} {
  if (!Number.isInteger(bucketA) || !Number.isInteger(bucketB) || bucketA < 0 || bucketB < 0) {
    throw new Error("balance counts must be non-negative integers");
  }
  const total = bucketA + bucketB;
  if (total === 0) return { gate: "OPEN", majorityShare: null, minorityBucket: null };

  const majority = Math.max(bucketA, bucketB);
  const majorityShare = majority / total;
  const minorityBucket = bucketA === bucketB ? null : bucketA < bucketB ? "bucket_a" : "bucket_b";

  if (majorityShare >= 0.7) return { gate: "HARD_GATE", majorityShare, minorityBucket };
  if (majorityShare >= 0.65) return { gate: "SOFT_WAITLIST", majorityShare, minorityBucket };
  if (majorityShare > 0.6) return { gate: "BOOST_MINORITY", majorityShare, minorityBucket };
  return { gate: "OPEN", majorityShare, minorityBucket };
}
