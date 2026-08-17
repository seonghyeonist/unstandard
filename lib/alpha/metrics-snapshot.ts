import "server-only";

import { sql } from "drizzle-orm";
import { ALPHA_STAGE_1_CAP, ALPHA_STAGE_1_PHASE, evaluateBalanceGate } from "@/lib/alpha/stage1-policy";
import {
  ALPHA_GROUP_MIN_SAMPLE,
  ALPHA_METRICS_CONTRACT_VERSION,
  evaluateFounderExperimentDecision,
  evaluateMetric,
  ratioMetric,
  withMetricsDigest,
  type AlphaGroupMetric,
} from "@/lib/alpha/metrics";
import { getDb } from "@/lib/db/client";

type CountRow = { numerator: number; denominator: number };
type ValueRow = { denominator: number; value: number | null };
type GroupRatioRow = { key: string; numerator: number; denominator: number };
type SeatRow = { cohort: string; channel: string; balance_bucket: string; status: string; count: number };
type SupplyDayRow = { day: string; bucket: string; count: number };

function n(value: unknown): number {
  return Number(value ?? 0);
}

function first<T>(rows: T[]): T | undefined {
  return rows[0];
}

function groupedD7(rows: GroupRatioRow[], name: string): AlphaGroupMetric[] {
  return rows.map((row) => ({
    key: String(row.key),
    ...ratioMetric({
      name,
      numerator: n(row.numerator),
      denominator: n(row.denominator),
      threshold: 0.45,
      minimumSample: ALPHA_GROUP_MIN_SAMPLE,
    }),
  }));
}

function supplyMaintenance(rows: SupplyDayRow[], asOf: Date) {
  const countsByDay = new Map<string, { bucket_a: number; bucket_b: number; total: number }>();
  for (const row of rows) {
    const day = String(row.day).slice(0, 10);
    const current = countsByDay.get(day) ?? { bucket_a: 0, bucket_b: 0, total: 0 };
    const count = n(row.count);
    current.total += count;
    if (row.bucket === "bucket_a") current.bucket_a += count;
    if (row.bucket === "bucket_b") current.bucket_b += count;
    countsByDay.set(day, current);
  }

  const sortedDays = [...countsByDay.keys()].sort();
  if (sortedDays.length === 0) {
    return {
      metric: ratioMetric({ name: "balance_maintained_days", numerator: 0, denominator: 0, threshold: 0.8 }),
      currentGate: evaluateBalanceGate(0, 0),
      countedCoverage: null,
    };
  }

  const start = new Date(`${sortedDays[0]}T00:00:00.000Z`);
  const end = new Date(`${asOf.toISOString().slice(0, 10)}T00:00:00.000Z`);
  let bucketA = 0;
  let bucketB = 0;
  let total = 0;
  let observedDays = 0;
  let balancedDays = 0;
  for (let day = start; day <= end; day = new Date(day.getTime() + 86_400_000)) {
    const additions = countsByDay.get(day.toISOString().slice(0, 10));
    if (additions) {
      bucketA += additions.bucket_a;
      bucketB += additions.bucket_b;
      total += additions.total;
    }
    if (bucketA + bucketB === 0) continue;
    observedDays += 1;
    const gate = evaluateBalanceGate(bucketA, bucketB);
    if ((gate.majorityShare ?? 1) <= 0.6) balancedDays += 1;
  }

  const countedCoverage = total > 0 ? (bucketA + bucketB) / total : null;
  const minimumSample = countedCoverage !== null && countedCoverage >= 0.8 ? 7 : Number.MAX_SAFE_INTEGER;
  return {
    metric: ratioMetric({
      name: "balance_maintained_days",
      numerator: balancedDays,
      denominator: observedDays,
      threshold: 0.8,
      minimumSample,
    }),
    currentGate: evaluateBalanceGate(bucketA, bucketB),
    countedCoverage,
  };
}

export async function buildAlphaMetricsSnapshot(asOf = new Date()) {
  const db = getDb();
  const populationSql = sql`
    SELECT u.id, u.created_at, i.recruitment_cohort, i.acquisition_channel
    FROM alpha_invites AS i
    JOIN users AS u ON u.id = i.consumed_by_user_id
    WHERE i.target_phase = ${ALPHA_STAGE_1_PHASE}
      AND i.status = 'consumed'
      AND u.invite_finalized_at IS NOT NULL
  `;

  const [seatsResult, onboardingResult, blurResult, responseResult, messageResult, d7Result,
    channelD7Result, cohortD7Result, waitlistResult, supplyResult] = await Promise.all([
    db.execute<SeatRow>(sql`
      SELECT recruitment_cohort AS cohort, acquisition_channel AS channel,
        balance_bucket, status, count(*)::int AS count
      FROM alpha_invites
      WHERE target_phase = ${ALPHA_STAGE_1_PHASE}
        AND (status = 'consumed' OR (status IN ('pending', 'reserved') AND expires_at > ${asOf}))
      GROUP BY recruitment_cohort, acquisition_channel, balance_bucket, status
      ORDER BY recruitment_cohort, acquisition_channel, balance_bucket, status
    `),
    db.execute<CountRow>(sql`
      WITH population AS (${populationSql})
      SELECT count(p.id) FILTER (WHERE p.onboarded_at IS NOT NULL)::int AS numerator,
        count(*)::int AS denominator
      FROM population
      LEFT JOIN profiles AS p ON p.user_id = population.id
    `),
    db.execute<ValueRow>(sql`
      WITH population AS (${populationSql}), first_unlock AS (
        SELECT population.id,
          extract(epoch FROM min(u.unlocked_at) - population.created_at)::float8 AS seconds
        FROM population
        JOIN unlocks AS u ON u.viewer_user_id = population.id
        GROUP BY population.id, population.created_at
      )
      SELECT count(*)::int AS denominator,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds)::float8 AS value
      FROM first_unlock
      WHERE seconds >= 0
    `),
    db.execute<CountRow>(sql`
      WITH population AS (${populationSql}), exposed AS (
        SELECT e.viewer_user_id, e.target_profile_id
        FROM alpha_profile_exposures AS e
        JOIN population ON population.id = e.viewer_user_id
      )
      SELECT count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM unlock_attempts AS ua
          WHERE ua.viewer_user_id = exposed.viewer_user_id
            AND ua.target_profile_id = exposed.target_profile_id
        ))::int AS numerator,
        count(*)::int AS denominator
      FROM exposed
    `),
    db.execute<ValueRow>(sql`
      WITH population AS (${populationSql}), ranked AS (
        SELECT m.sender_user_id, char_length(m.body)::float8 AS characters,
          row_number() OVER (PARTITION BY m.sender_user_id ORDER BY m.created_at, m.id) AS position
        FROM messages AS m
        JOIN population ON population.id = m.sender_user_id
      )
      SELECT count(*)::int AS denominator, avg(characters)::float8 AS value
      FROM ranked WHERE position = 1
    `),
    db.execute<CountRow>(sql`
      WITH population AS (${populationSql}), eligible AS (
        SELECT * FROM population
        WHERE timezone('UTC', created_at)::date <= timezone('UTC', ${asOf}::timestamptz)::date - 7
      )
      SELECT count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM alpha_activity_days AS a
          WHERE a.user_id = eligible.id
            AND a.activity_date = timezone('UTC', eligible.created_at)::date + 7
        ))::int AS numerator,
        count(*)::int AS denominator
      FROM eligible
    `),
    db.execute<GroupRatioRow>(sql`
      WITH population AS (${populationSql}), eligible AS (
        SELECT * FROM population
        WHERE timezone('UTC', created_at)::date <= timezone('UTC', ${asOf}::timestamptz)::date - 7
      )
      SELECT acquisition_channel AS key,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM alpha_activity_days AS a
          WHERE a.user_id = eligible.id
            AND a.activity_date = timezone('UTC', eligible.created_at)::date + 7
        ))::int AS numerator,
        count(*)::int AS denominator
      FROM eligible GROUP BY acquisition_channel ORDER BY acquisition_channel
    `),
    db.execute<GroupRatioRow>(sql`
      WITH population AS (${populationSql}), eligible AS (
        SELECT * FROM population
        WHERE timezone('UTC', created_at)::date <= timezone('UTC', ${asOf}::timestamptz)::date - 7
      )
      SELECT recruitment_cohort AS key,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM alpha_activity_days AS a
          WHERE a.user_id = eligible.id
            AND a.activity_date = timezone('UTC', eligible.created_at)::date + 7
        ))::int AS numerator,
        count(*)::int AS denominator
      FROM eligible GROUP BY recruitment_cohort ORDER BY recruitment_cohort
    `),
    db.execute<CountRow>(sql`
      SELECT count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM waitlist_visit_days AS v
          WHERE v.waitlist_entry_id = e.id
            AND v.visit_date > timezone('UTC', e.created_at)::date
        ))::int AS numerator,
        count(*)::int AS denominator
      FROM waitlist_entries AS e
    `),
    db.execute<SupplyDayRow>(sql`
      SELECT timezone('UTC', consumed_at)::date::text AS day,
        balance_bucket AS bucket, count(*)::int AS count
      FROM alpha_invites
      WHERE target_phase = ${ALPHA_STAGE_1_PHASE}
        AND status = 'consumed' AND consumed_at IS NOT NULL
        AND balance_bucket IN ('bucket_a', 'bucket_b')
        AND balance_consent_version = 'stage1-role-preference-v1'
        AND balance_consented_on IS NOT NULL
      GROUP BY timezone('UTC', consumed_at)::date, balance_bucket
      ORDER BY day, bucket
    `),
  ]);

  const onboardingRow = first(onboardingResult.rows);
  const onboarding = ratioMetric({
    name: "onboarding_completion",
    numerator: n(onboardingRow?.numerator),
    denominator: n(onboardingRow?.denominator),
    threshold: 0.75,
  });
  const blurRow = first(blurResult.rows);
  const firstBlur = evaluateMetric({
    name: "signup_to_first_blur_median",
    denominator: n(blurRow?.denominator),
    value: blurRow?.value === null || blurRow?.value === undefined ? null : n(blurRow.value),
    threshold: 180,
    comparator: "<=",
    unit: "seconds",
  });
  const responseRow = first(responseResult.rows);
  const questionResponse = ratioMetric({
    name: "question_response",
    numerator: n(responseRow?.numerator),
    denominator: n(responseRow?.denominator),
    threshold: 0.55,
  });
  const messageRow = first(messageResult.rows);
  const firstMessage = evaluateMetric({
    name: "first_message_mean_length",
    denominator: n(messageRow?.denominator),
    value: messageRow?.value === null || messageRow?.value === undefined ? null : n(messageRow.value),
    threshold: 25,
    comparator: ">=",
    unit: "characters",
  });
  const d7Row = first(d7Result.rows);
  const overallD7 = ratioMetric({
    name: "overall_d7",
    numerator: n(d7Row?.numerator),
    denominator: n(d7Row?.denominator),
    threshold: 0.4,
  });
  const waitlistRow = first(waitlistResult.rows);
  const waitlistRevisit = ratioMetric({
    name: "waitlist_revisit",
    numerator: n(waitlistRow?.numerator),
    denominator: n(waitlistRow?.denominator),
    threshold: 0.25,
  });
  const channelD7 = groupedD7(channelD7Result.rows, "channel_d7");
  const cohortD7 = groupedD7(cohortD7Result.rows, "cohort_d7");
  const supply = supplyMaintenance(supplyResult.rows, asOf);
  const productLowerBounds = [onboarding, firstBlur, questionResponse, firstMessage];
  const decision = evaluateFounderExperimentDecision({
    productLowerBounds,
    channelD7,
    waitlistRevisit,
    onboarding,
    questionResponse,
    balanceMaintenance: supply.metric,
    cohortD7,
  });

  const occupiedSeats = seatsResult.rows.reduce((sum, row) => sum + n(row.count), 0);
  const base = {
    artifactVersion: 1 as const,
    kind: "alpha_stage1_metrics_snapshot" as const,
    contractVersion: ALPHA_METRICS_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    asOf: asOf.toISOString(),
    stage: ALPHA_STAGE_1_PHASE,
    capacity: { occupiedSeats, maximumSeats: ALPHA_STAGE_1_CAP },
    recruitment: seatsResult.rows.map((row) => ({ ...row, count: n(row.count) })),
    metrics: {
      productLowerBounds,
      overallD7,
      channelD7,
      cohortD7,
      waitlistRevisit,
      balanceMaintenance: supply.metric,
      currentBalanceGate: supply.currentGate,
      countedBalanceCoverage: supply.countedCoverage,
      fastTrackMeanDepth: { status: "NOT_IMPLEMENTED" as const },
    },
    decision,
    definitions: {
      d7: "activity on the exact seventh UTC calendar day after registration",
      questionResponse: "unique exposed viewer/profile pairs with at least one unlock attempt",
      firstMessage: "mean Unicode character length of each sender's first persisted message",
      waitlistRevisit: "waitlist entry with a visit on a later UTC date",
      balance: "share of observed days at or below 60:40 over consented opaque A/B buckets; >=80% bucket coverage required",
    },
  };
  return withMetricsDigest(base);
}
