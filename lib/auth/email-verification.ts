import "server-only";

import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { DbExecutor } from "@/lib/db/types";
import { alphaEmailVerifications } from "@/lib/db/schema/email-verification";
import { alphaInvites } from "@/lib/db/schema/invites";
import { ALPHA_STAGE_1_PHASE } from "@/lib/alpha/stage1-policy";
import {
  EMAIL_VERIFICATION_MAX_ATTEMPTS,
  EMAIL_VERIFICATION_SEND_COOLDOWN_MS,
  EMAIL_VERIFICATION_TTL_MS,
  generateEmailVerificationCode,
  hashEmailVerificationCode,
  isValidEmailVerificationCode,
  safeEqualHex,
} from "@/lib/auth/email-verification-crypto";
import { normalizeEmail } from "@/lib/auth/invite-crypto";
import type { EmailVerificationTicket } from "@/lib/auth/invite-ticket";

function requireEmailVerificationSecret(): string {
  const secret =
    process.env.ALPHA_EMAIL_VERIFICATION_PEPPER?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) throw new Error("ALPHA_EMAIL_VERIFICATION_SECRET_UNAVAILABLE");
  return secret;
}

export type CreateEmailVerificationResult =
  | {
      ok: true;
      challengeId: string;
      email: string;
      code: string;
      expiresAt: Date;
    }
  | { ok: false; code: "INVALID_INVITE" | "COOLDOWN"; retryAfterSeconds?: number };

export type VerifyEmailVerificationResult =
  | { ok: true; challengeId: string; inviteId: string; email: string }
  | {
      ok: false;
      code: "INVALID_CODE" | "EXPIRED" | "ATTEMPTS_EXCEEDED" | "INVALID_CHALLENGE";
    };

type InviteVerificationState = {
  emailNormalized: string;
  status: string;
  expiresAt: Date;
  targetPhase: string;
};

async function readInviteState(
  inviteId: string,
  db: DbExecutor,
  lock = false,
): Promise<InviteVerificationState | null> {
  const query = db
    .select({
      emailNormalized: alphaInvites.emailNormalized,
      status: alphaInvites.status,
      expiresAt: alphaInvites.expiresAt,
      targetPhase: alphaInvites.targetPhase,
    })
    .from(alphaInvites)
    .where(eq(alphaInvites.id, inviteId))
    .limit(1);

  const rows = await (lock ? query.for("update") : query);
  return rows[0] ?? null;
}

/**
 * Create a one-time pre-account challenge. The invite row is locked so two
 * resend requests cannot both leave active codes behind.
 */
export async function createEmailVerificationChallenge(input: {
  inviteId: string;
  email: string;
}): Promise<CreateEmailVerificationResult> {
  const email = normalizeEmail(input.email);
  if (!input.inviteId || !email) return { ok: false, code: "INVALID_INVITE" };

  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS);
  const secret = requireEmailVerificationSecret();

  return db.transaction(async (tx) => {
    const invite = await readInviteState(input.inviteId, tx, true);
    if (
      !invite ||
      invite.emailNormalized !== email ||
      invite.targetPhase !== ALPHA_STAGE_1_PHASE ||
      invite.status !== "pending" ||
      invite.expiresAt.getTime() <= now.getTime()
    ) {
      return { ok: false, code: "INVALID_INVITE" };
    }

    const [active] = await tx
      .select({ sentAt: alphaEmailVerifications.sentAt })
      .from(alphaEmailVerifications)
      .where(
        and(
          eq(alphaEmailVerifications.inviteId, input.inviteId),
          isNull(alphaEmailVerifications.invalidatedAt),
          isNull(alphaEmailVerifications.consumedAt),
          gt(alphaEmailVerifications.expiresAt, now),
        ),
      )
      .orderBy(desc(alphaEmailVerifications.sentAt))
      .limit(1);

    if (active) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((active.sentAt.getTime() + EMAIL_VERIFICATION_SEND_COOLDOWN_MS - now.getTime()) / 1_000),
      );
      if (retryAfterSeconds > 1) return { ok: false, code: "COOLDOWN", retryAfterSeconds };
    }

    await tx
      .update(alphaEmailVerifications)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(alphaEmailVerifications.inviteId, input.inviteId),
          isNull(alphaEmailVerifications.invalidatedAt),
          isNull(alphaEmailVerifications.consumedAt),
        ),
      );

    const challengeId = crypto.randomUUID();
    const code = generateEmailVerificationCode();
    await tx.insert(alphaEmailVerifications).values({
      id: challengeId,
      inviteId: input.inviteId,
      emailNormalized: email,
      codeHash: hashEmailVerificationCode(challengeId, email, code, secret),
      attemptCount: 0,
      sentAt: now,
      expiresAt,
    });

    return { ok: true, challengeId, email, code, expiresAt };
  });
}

export async function invalidateEmailVerificationChallenge(
  challengeId: string,
): Promise<void> {
  if (!challengeId) return;
  await getDb()
    .update(alphaEmailVerifications)
    .set({ invalidatedAt: new Date() })
    .where(
      and(
        eq(alphaEmailVerifications.id, challengeId),
        isNull(alphaEmailVerifications.verifiedAt),
        isNull(alphaEmailVerifications.consumedAt),
      ),
    );
}

export async function verifyEmailVerificationCode(input: {
  challengeId: string;
  inviteId: string;
  email: string;
  code: string;
}): Promise<VerifyEmailVerificationResult> {
  const email = normalizeEmail(input.email);
  if (!input.challengeId || !input.inviteId || !email || !isValidEmailVerificationCode(input.code)) {
    return { ok: false, code: "INVALID_CODE" };
  }

  const secret = requireEmailVerificationSecret();
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const [challenge] = await tx
      .select({
        inviteId: alphaEmailVerifications.inviteId,
        emailNormalized: alphaEmailVerifications.emailNormalized,
        codeHash: alphaEmailVerifications.codeHash,
        attemptCount: alphaEmailVerifications.attemptCount,
        expiresAt: alphaEmailVerifications.expiresAt,
        verifiedAt: alphaEmailVerifications.verifiedAt,
        consumedAt: alphaEmailVerifications.consumedAt,
        invalidatedAt: alphaEmailVerifications.invalidatedAt,
      })
      .from(alphaEmailVerifications)
      .where(eq(alphaEmailVerifications.id, input.challengeId))
      .for("update")
      .limit(1);

    if (!challenge || challenge.inviteId !== input.inviteId || challenge.emailNormalized !== email) {
      return { ok: false, code: "INVALID_CHALLENGE" };
    }
    if (challenge.consumedAt || challenge.invalidatedAt || challenge.verifiedAt) {
      return { ok: false, code: "INVALID_CHALLENGE" };
    }
    if (challenge.expiresAt.getTime() <= now.getTime()) {
      return { ok: false, code: "EXPIRED" };
    }
    if (challenge.attemptCount >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
      return { ok: false, code: "ATTEMPTS_EXCEEDED" };
    }

    const expected = hashEmailVerificationCode(input.challengeId, email, input.code, secret);
    if (!safeEqualHex(challenge.codeHash, expected)) {
      const nextAttemptCount = challenge.attemptCount + 1;
      await tx
        .update(alphaEmailVerifications)
        .set({
          attemptCount: nextAttemptCount,
          invalidatedAt: nextAttemptCount >= EMAIL_VERIFICATION_MAX_ATTEMPTS ? now : null,
        })
        .where(eq(alphaEmailVerifications.id, input.challengeId));
      return {
        ok: false,
        code: nextAttemptCount >= EMAIL_VERIFICATION_MAX_ATTEMPTS ? "ATTEMPTS_EXCEEDED" : "INVALID_CODE",
      };
    }

    const invite = await readInviteState(input.inviteId, tx);
    if (
      !invite ||
      invite.emailNormalized !== email ||
      invite.targetPhase !== ALPHA_STAGE_1_PHASE ||
      invite.status !== "pending" ||
      invite.expiresAt.getTime() <= now.getTime()
    ) {
      return { ok: false, code: "INVALID_CHALLENGE" };
    }

    await tx
      .update(alphaEmailVerifications)
      .set({ verifiedAt: now })
      .where(eq(alphaEmailVerifications.id, input.challengeId));

    return { ok: true, challengeId: input.challengeId, inviteId: input.inviteId, email };
  });
}

/** Check the database proof behind a signed browser ticket. */
export async function isEmailVerificationTicketUsable(
  ticket: EmailVerificationTicket,
  db: DbExecutor = getDb(),
): Promise<boolean> {
  const email = normalizeEmail(ticket.email);
  if (!ticket.inviteId || !ticket.challengeId || !email || ticket.exp <= Date.now()) return false;

  const [challenge] = await db
    .select({
      inviteId: alphaEmailVerifications.inviteId,
      emailNormalized: alphaEmailVerifications.emailNormalized,
      expiresAt: alphaEmailVerifications.expiresAt,
      verifiedAt: alphaEmailVerifications.verifiedAt,
      consumedAt: alphaEmailVerifications.consumedAt,
      invalidatedAt: alphaEmailVerifications.invalidatedAt,
    })
    .from(alphaEmailVerifications)
    .where(eq(alphaEmailVerifications.id, ticket.challengeId))
    .limit(1);
  if (
    !challenge ||
    challenge.inviteId !== ticket.inviteId ||
    challenge.emailNormalized !== email ||
    !challenge.verifiedAt ||
    challenge.consumedAt ||
    challenge.invalidatedAt ||
    challenge.expiresAt.getTime() <= Date.now()
  ) return false;

  const invite = await readInviteState(ticket.inviteId, db);
  return Boolean(
    invite &&
      invite.emailNormalized === email &&
      invite.targetPhase === ALPHA_STAGE_1_PHASE &&
      (invite.status === "pending" || invite.status === "reserved") &&
      invite.expiresAt.getTime() > Date.now(),
  );
}

/**
 * Consume the email proof inside the same application transaction that
 * consumes the invite and records legal acceptance.
 */
export async function consumeEmailVerificationProof(input: {
  challengeId: string;
  inviteId: string;
  email: string;
  userId: string;
  db: DbExecutor;
}): Promise<boolean> {
  const email = normalizeEmail(input.email);
  if (!email) return false;

  const now = new Date();
  const [challenge] = await input.db
    .select({
      inviteId: alphaEmailVerifications.inviteId,
      emailNormalized: alphaEmailVerifications.emailNormalized,
      expiresAt: alphaEmailVerifications.expiresAt,
      verifiedAt: alphaEmailVerifications.verifiedAt,
      consumedAt: alphaEmailVerifications.consumedAt,
      invalidatedAt: alphaEmailVerifications.invalidatedAt,
    })
    .from(alphaEmailVerifications)
    .where(eq(alphaEmailVerifications.id, input.challengeId))
    .for("update")
    .limit(1);
  if (
    !challenge ||
    challenge.inviteId !== input.inviteId ||
    challenge.emailNormalized !== email ||
    !challenge.verifiedAt ||
    challenge.consumedAt ||
    challenge.invalidatedAt ||
    challenge.expiresAt.getTime() <= now.getTime()
  ) return false;

  const updated = await input.db
    .update(alphaEmailVerifications)
    .set({ consumedAt: now, consumedByUserId: input.userId })
    .where(
      and(
        eq(alphaEmailVerifications.id, input.challengeId),
        eq(alphaEmailVerifications.inviteId, input.inviteId),
        eq(alphaEmailVerifications.emailNormalized, email),
        isNull(alphaEmailVerifications.consumedAt),
        isNull(alphaEmailVerifications.invalidatedAt),
        gt(alphaEmailVerifications.expiresAt, now),
      ),
    )
    .returning({ id: alphaEmailVerifications.id });
  return updated.length === 1;
}

/** A small maintenance helper for stale rows; it never touches users. */
export async function expireEmailVerificationChallenges(): Promise<number> {
  const now = new Date();
  const result = await getDb()
    .update(alphaEmailVerifications)
    .set({ invalidatedAt: now })
    .where(
      and(
        lt(alphaEmailVerifications.expiresAt, now),
        isNull(alphaEmailVerifications.invalidatedAt),
        isNull(alphaEmailVerifications.consumedAt),
      ),
    )
    .returning({ id: alphaEmailVerifications.id });
  return result.length;
}
