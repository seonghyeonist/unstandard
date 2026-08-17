import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import {
  ALPHA_STAGE_1_CAP,
  ALPHA_STAGE_1_PHASE,
  evaluateBalanceGate,
  type AlphaAcquisitionChannel,
  type AlphaBalanceBucket,
  type AlphaRecruitmentCohort,
} from "@/lib/alpha/stage1-policy";
import {
  generateInviteCode,
  hashInviteCode,
  normalizeEmail,
  requireInvitePepper,
} from "@/lib/auth/invite-crypto";
import { getDb } from "@/lib/db/client";
import { alphaInvites } from "@/lib/db/schema/invites";

export type CreateStage1InviteInput = {
  email: string;
  recruitmentCohort: AlphaRecruitmentCohort;
  acquisitionChannel: AlphaAcquisitionChannel;
  balanceBucket: AlphaBalanceBucket;
  now?: Date;
};

export type CreateStage1InviteResult = {
  inviteId: string;
  email: string;
  rawCode: string;
  expiresAt: Date;
  occupiedSeats: number;
  balanceGate: ReturnType<typeof evaluateBalanceGate>;
};

export class Stage1InviteError extends Error {
  constructor(
    readonly code:
      | "CAPACITY_REACHED"
      | "ACTIVE_EMAIL_EXISTS"
      | "BALANCE_SOFT_WAITLIST"
      | "BALANCE_HARD_GATE",
  ) {
    super(code);
    this.name = "Stage1InviteError";
  }
}

type SeatObservation = {
  active_seats: number;
  bucket_a: number;
  bucket_b: number;
};

function wouldAddToMajority(
  bucket: AlphaBalanceBucket,
  gate: ReturnType<typeof evaluateBalanceGate>,
): boolean {
  if (bucket === "not_counted" || !gate.minorityBucket) return false;
  return bucket !== gate.minorityBucket;
}

/**
 * The database trigger is the final capacity authority. This transaction also
 * holds the same advisory lock so the operator receives deterministic error
 * codes and a coherent seat/balance observation.
 */
export async function createStage1Invite(
  input: CreateStage1InviteInput,
): Promise<CreateStage1InviteResult> {
  const email = normalizeEmail(input.email);
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const rawCode = generateInviteCode();
  const codeHash = hashInviteCode(rawCode, requireInvitePepper());
  const db = getDb();

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('unstandard:alpha-stage-1:capacity'))`);

    await tx
      .update(alphaInvites)
      .set({ status: "expired", reservedAt: null, reservationNonceHash: null })
      .where(
        and(
          eq(alphaInvites.targetPhase, ALPHA_STAGE_1_PHASE),
          inArray(alphaInvites.status, ["pending", "reserved"]),
          sql`${alphaInvites.expiresAt} <= ${now}`,
        ),
      );

    const [activeForEmail] = await tx
      .select({ id: alphaInvites.id })
      .from(alphaInvites)
      .where(
        and(
          eq(alphaInvites.targetPhase, ALPHA_STAGE_1_PHASE),
          eq(alphaInvites.emailNormalized, email),
          inArray(alphaInvites.status, ["pending", "reserved", "consumed"]),
        ),
      )
      .limit(1);
    if (activeForEmail) throw new Stage1InviteError("ACTIVE_EMAIL_EXISTS");

    const observation = await tx.execute<SeatObservation>(sql`
      SELECT
        count(*)::int AS active_seats,
        count(*) FILTER (WHERE balance_bucket = 'bucket_a')::int AS bucket_a,
        count(*) FILTER (WHERE balance_bucket = 'bucket_b')::int AS bucket_b
      FROM alpha_invites
      WHERE target_phase = ${ALPHA_STAGE_1_PHASE}
        AND (
          status = 'consumed'
          OR (status IN ('pending', 'reserved') AND expires_at > ${now})
        )
    `);
    const seats = Number(observation.rows[0]?.active_seats ?? 0);
    const bucketA = Number(observation.rows[0]?.bucket_a ?? 0);
    const bucketB = Number(observation.rows[0]?.bucket_b ?? 0);
    if (seats >= ALPHA_STAGE_1_CAP) throw new Stage1InviteError("CAPACITY_REACHED");

    const projectedA = bucketA + (input.balanceBucket === "bucket_a" ? 1 : 0);
    const projectedB = bucketB + (input.balanceBucket === "bucket_b" ? 1 : 0);
    const balanceGate = evaluateBalanceGate(projectedA, projectedB);
    if (wouldAddToMajority(input.balanceBucket, balanceGate)) {
      if (balanceGate.gate === "HARD_GATE") {
        throw new Stage1InviteError("BALANCE_HARD_GATE");
      }
      if (balanceGate.gate === "SOFT_WAITLIST") {
        throw new Stage1InviteError("BALANCE_SOFT_WAITLIST");
      }
    }

    const [created] = await tx
      .insert(alphaInvites)
      .values({
        emailNormalized: email,
        codeHash,
        status: "pending",
        expiresAt,
        targetPhase: ALPHA_STAGE_1_PHASE,
        recruitmentCohort: input.recruitmentCohort,
        acquisitionChannel: input.acquisitionChannel,
        balanceBucket: input.balanceBucket,
      })
      .returning({ id: alphaInvites.id });

    if (!created) throw new Error("invite insert returned no row");
    return {
      inviteId: created.id,
      email,
      rawCode,
      expiresAt,
      occupiedSeats: seats + 1,
      balanceGate,
    };
  });
}
