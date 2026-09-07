import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ALPHA_BALANCE_CONSENT_VERSION,
  ALPHA_STAGE_1_CAP,
  ALPHA_STAGE_1_PHASE,
  evaluateBalanceGate,
  isAlphaAcquisitionChannel,
  isAlphaBalanceBucket,
  isAlphaRecruitmentCohort,
  validateAlphaBalanceConsent,
  type AlphaAcquisitionChannel,
  type AlphaBalanceBucket,
  type AlphaBalanceConsent,
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
  balanceConsent: AlphaBalanceConsent | null;
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

export type OperatorInviteSummary = {
  id: string;
  emailMasked: string;
  status: string;
  expiresAt: Date;
  recruitmentCohort: string;
  acquisitionChannel: string;
  balanceBucket: string;
};

function maskEmail(email: string): string {
  return email.replace(/(^.).*(@.*$)/, "$1***$2");
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
  validateAlphaBalanceConsent(input.balanceBucket, input.balanceConsent);
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
        balanceConsentVersion: input.balanceConsent?.version ?? null,
        balanceConsentedOn: input.balanceConsent?.consentedOn ?? null,
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

/** Operator-facing status contains no raw invite capability or full email. */
export async function listStage1Invites(): Promise<OperatorInviteSummary[]> {
  const rows = await getDb()
    .select({
      id: alphaInvites.id,
      emailNormalized: alphaInvites.emailNormalized,
      status: alphaInvites.status,
      expiresAt: alphaInvites.expiresAt,
      recruitmentCohort: alphaInvites.recruitmentCohort,
      acquisitionChannel: alphaInvites.acquisitionChannel,
      balanceBucket: alphaInvites.balanceBucket,
    })
    .from(alphaInvites)
    .where(eq(alphaInvites.targetPhase, ALPHA_STAGE_1_PHASE))
    .orderBy(desc(alphaInvites.createdAt));
  return rows.map((row) => ({
    id: row.id,
    emailMasked: maskEmail(row.emailNormalized),
    status: row.status,
    expiresAt: row.expiresAt,
    recruitmentCohort: row.recruitmentCohort,
    acquisitionChannel: row.acquisitionChannel,
    balanceBucket: row.balanceBucket,
  }));
}

export async function revokeStage1Invite(inviteId: string): Promise<boolean> {
  const revoked = await getDb()
    .update(alphaInvites)
    .set({ status: "revoked", reservedAt: null, reservationNonceHash: null })
    .where(and(
      eq(alphaInvites.id, inviteId),
      eq(alphaInvites.targetPhase, ALPHA_STAGE_1_PHASE),
      inArray(alphaInvites.status, ["pending", "reserved"]),
    ))
    .returning({ id: alphaInvites.id });
  return revoked.length === 1;
}

/** Reissue only terminal, unconsumed invitations; consumed seats are never recycled here. */
export async function reissueStage1Invite(inviteId: string): Promise<CreateStage1InviteResult> {
  const [row] = await getDb()
    .select({
      emailNormalized: alphaInvites.emailNormalized,
      status: alphaInvites.status,
      recruitmentCohort: alphaInvites.recruitmentCohort,
      acquisitionChannel: alphaInvites.acquisitionChannel,
      balanceBucket: alphaInvites.balanceBucket,
      balanceConsentVersion: alphaInvites.balanceConsentVersion,
      balanceConsentedOn: alphaInvites.balanceConsentedOn,
    })
    .from(alphaInvites)
    .where(and(eq(alphaInvites.id, inviteId), eq(alphaInvites.targetPhase, ALPHA_STAGE_1_PHASE)))
    .limit(1);
  if (!row || !["revoked", "expired"].includes(row.status)) {
    throw new Stage1InviteError("ACTIVE_EMAIL_EXISTS");
  }
  if (!isAlphaRecruitmentCohort(row.recruitmentCohort) ||
      !isAlphaAcquisitionChannel(row.acquisitionChannel) ||
      !isAlphaBalanceBucket(row.balanceBucket)) {
    throw new Error("INVITE_METADATA_INVALID");
  }
  const balanceConsent = row.balanceBucket === "not_counted"
    ? null
    : row.balanceConsentVersion === ALPHA_BALANCE_CONSENT_VERSION && row.balanceConsentedOn
      ? { version: ALPHA_BALANCE_CONSENT_VERSION, consentedOn: String(row.balanceConsentedOn) }
      : null;
  return createStage1Invite({
    email: row.emailNormalized,
    recruitmentCohort: row.recruitmentCohort,
    acquisitionChannel: row.acquisitionChannel,
    balanceBucket: row.balanceBucket,
    balanceConsent,
  });
}
