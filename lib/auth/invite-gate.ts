import "server-only";

import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { DbExecutor } from "@/lib/db/types";
import { alphaInvites } from "@/lib/db/schema/invites";
import {
  generateReservationNonce,
  hashInviteCode,
  hashReservationNonce,
  normalizeEmail,
  requireInvitePepper,
} from "@/lib/auth/invite-crypto";
import type { RegistrationTicket } from "@/lib/auth/invite-ticket";
import { INVITE_RESERVATION_TTL_MS } from "@/lib/auth/invite-ticket";
import { ALPHA_STAGE_1_PHASE } from "@/lib/alpha/stage1-policy";

export type InviteReserveResult =
  | { ok: true; inviteId: string; email: string; reservationCapability: string }
  | { ok: false; code: "INVALID" | "EXPIRED" | "REVOKED" | "CONSUMED" | "EMAIL_MISMATCH" };

export type InviteConsumeResult =
  | { ok: true }
  | { ok: false; code: "NOT_RESERVED" | "NONCE_MISMATCH" | "EXPIRED" | "ALREADY_CONSUMED" };

export type InvitePrepareResult =
  | { ok: true; inviteId: string; email: string }
  | { ok: false; code: "INVALID" | "EXPIRED" | "REVOKED" | "CONSUMED" };

export async function reserveInviteForEmail(
  rawCode: string,
  email: string,
): Promise<InviteReserveResult> {
  const pepper = requireInvitePepper();
  const codeHash = hashInviteCode(rawCode, pepper);
  const emailNormalized = normalizeEmail(email);
  const reservationCapability = generateReservationNonce();
  const reservationNonceHash = hashReservationNonce(reservationCapability, pepper);
  const db = getDb();
  const now = new Date();

  await releaseStaleReservedInvites();

  const reserved = await db
    .update(alphaInvites)
    .set({
      status: "reserved",
      reservedAt: now,
      reservationNonceHash,
    })
    .where(
      and(
        eq(alphaInvites.codeHash, codeHash),
        eq(alphaInvites.emailNormalized, emailNormalized),
        eq(alphaInvites.targetPhase, ALPHA_STAGE_1_PHASE),
        eq(alphaInvites.status, "pending"),
        gt(alphaInvites.expiresAt, now),
      ),
    )
    .returning({ id: alphaInvites.id });

  if (reserved.length === 1) {
    return {
      ok: true,
      inviteId: reserved[0].id,
      email: emailNormalized,
      reservationCapability,
    };
  }

  const [existing] = await db
    .select({
      status: alphaInvites.status,
      emailNormalized: alphaInvites.emailNormalized,
      expiresAt: alphaInvites.expiresAt,
      targetPhase: alphaInvites.targetPhase,
    })
    .from(alphaInvites)
    .where(eq(alphaInvites.codeHash, codeHash))
    .limit(1);

  if (!existing) {
    return { ok: false, code: "INVALID" };
  }
  if (existing.emailNormalized !== emailNormalized) {
    return { ok: false, code: "EMAIL_MISMATCH" };
  }
  if (existing.targetPhase !== ALPHA_STAGE_1_PHASE) {
    return { ok: false, code: "INVALID" };
  }
  if (existing.status === "revoked") {
    return { ok: false, code: "REVOKED" };
  }
  if (existing.status === "consumed") {
    return { ok: false, code: "CONSUMED" };
  }
  if (existing.expiresAt.getTime() < Date.now() || existing.status === "expired") {
    return { ok: false, code: "EXPIRED" };
  }

  return { ok: false, code: "INVALID" };
}

/**
 * Validates an invite capability without changing its state. This is used only
 * by the same-origin fragment exchange; GET, link preview and prefetch paths
 * never call a reservation or consumption function.
 */
export async function prepareInviteForRegistration(rawCode: string): Promise<InvitePrepareResult> {
  const code = rawCode.trim();
  if (code.length < 8) return { ok: false, code: "INVALID" };

  const pepper = requireInvitePepper();
  const codeHash = hashInviteCode(code, pepper);
  const db = getDb();
  const [invite] = await db
    .select({
      id: alphaInvites.id,
      emailNormalized: alphaInvites.emailNormalized,
      status: alphaInvites.status,
      expiresAt: alphaInvites.expiresAt,
      targetPhase: alphaInvites.targetPhase,
    })
    .from(alphaInvites)
    .where(eq(alphaInvites.codeHash, codeHash))
    .limit(1);

  if (!invite || invite.targetPhase !== ALPHA_STAGE_1_PHASE) return { ok: false, code: "INVALID" };
  if (invite.status === "revoked") return { ok: false, code: "REVOKED" };
  if (invite.status === "consumed") return { ok: false, code: "CONSUMED" };
  if (invite.expiresAt.getTime() <= Date.now() || invite.status === "expired") {
    return { ok: false, code: "EXPIRED" };
  }
  // A reservation is bound to the browser that passed legal consent. Do not
  // let a second browser obtain fresh pre-registration state from the same
  // capability while the first reservation is still live.
  if (invite.status !== "pending") return { ok: false, code: "INVALID" };

  return { ok: true, inviteId: invite.id, email: invite.emailNormalized };
}

/** Validate signed prepared state against the current invite row without changing state. */
export async function isPreparedInviteUsable(input: {
  inviteId: string;
  email: string;
}): Promise<boolean> {
  const emailNormalized = normalizeEmail(input.email);
  if (!input.inviteId || !emailNormalized) return false;

  const [invite] = await getDb()
    .select({
      emailNormalized: alphaInvites.emailNormalized,
      status: alphaInvites.status,
      expiresAt: alphaInvites.expiresAt,
      targetPhase: alphaInvites.targetPhase,
    })
    .from(alphaInvites)
    .where(eq(alphaInvites.id, input.inviteId))
    .limit(1);

  return Boolean(
    invite &&
      invite.emailNormalized === emailNormalized &&
      invite.targetPhase === ALPHA_STAGE_1_PHASE &&
      invite.status === "pending" &&
      invite.expiresAt.getTime() > Date.now(),
  );
}

/** Reserve a previously prepared invite after explicit legal acceptance. */
export async function reservePreparedInvite(
  inviteId: string,
  email: string,
): Promise<InviteReserveResult> {
  const pepper = requireInvitePepper();
  const emailNormalized = normalizeEmail(email);
  const reservationCapability = generateReservationNonce();
  const reservationNonceHash = hashReservationNonce(reservationCapability, pepper);
  const db = getDb();
  const now = new Date();

  await releaseStaleReservedInvites();

  const reserved = await db
    .update(alphaInvites)
    .set({
      status: "reserved",
      reservedAt: now,
      reservationNonceHash,
    })
    .where(
      and(
        eq(alphaInvites.id, inviteId),
        eq(alphaInvites.emailNormalized, emailNormalized),
        eq(alphaInvites.targetPhase, ALPHA_STAGE_1_PHASE),
        eq(alphaInvites.status, "pending"),
        gt(alphaInvites.expiresAt, now),
      ),
    )
    .returning({ id: alphaInvites.id });

  if (reserved.length === 1) {
    return { ok: true, inviteId, email: emailNormalized, reservationCapability };
  }

  return { ok: false, code: "INVALID" };
}

/** @deprecated Use reserveInviteForEmail — kept for transitional imports */
export const claimInviteForEmail = reserveInviteForEmail;

export async function verifyInviteReservation(ticket: RegistrationTicket): Promise<boolean> {
  const pepper = requireInvitePepper();
  const nonceHash = hashReservationNonce(ticket.capability, pepper);
  const db = getDb();
  const now = new Date();

  const [invite] = await db
    .select({
      status: alphaInvites.status,
      emailNormalized: alphaInvites.emailNormalized,
      reservationNonceHash: alphaInvites.reservationNonceHash,
      expiresAt: alphaInvites.expiresAt,
      targetPhase: alphaInvites.targetPhase,
    })
    .from(alphaInvites)
    .where(eq(alphaInvites.id, ticket.inviteId))
    .limit(1);

  if (!invite) return false;
  if (invite.targetPhase !== ALPHA_STAGE_1_PHASE) return false;
  if (invite.status !== "reserved") return false;
  if (invite.emailNormalized !== ticket.email) return false;
  if (invite.reservationNonceHash !== nonceHash) return false;
  if (invite.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

export async function consumeReservedInvite(
  inviteId: string,
  userId: string,
  reservationCapability: string,
  db: DbExecutor = getDb(),
): Promise<InviteConsumeResult> {
  const pepper = requireInvitePepper();
  const nonceHash = hashReservationNonce(reservationCapability, pepper);
  const now = new Date();

  const consumed = await db
    .update(alphaInvites)
    .set({
      status: "consumed",
      consumedAt: now,
      consumedByUserId: userId,
    })
    .where(
      and(
        eq(alphaInvites.id, inviteId),
        eq(alphaInvites.targetPhase, ALPHA_STAGE_1_PHASE),
        eq(alphaInvites.status, "reserved"),
        eq(alphaInvites.reservationNonceHash, nonceHash),
        gt(alphaInvites.expiresAt, now),
      ),
    )
    .returning({ id: alphaInvites.id });

  if (consumed.length === 1) {
    return { ok: true };
  }

  const [existing] = await db
    .select({ status: alphaInvites.status })
    .from(alphaInvites)
    .where(eq(alphaInvites.id, inviteId))
    .limit(1);

  if (!existing) {
    return { ok: false, code: "NOT_RESERVED" };
  }
  if (existing.status === "consumed") {
    return { ok: false, code: "ALREADY_CONSUMED" };
  }
  return { ok: false, code: "NONCE_MISMATCH" };
}

export async function releaseStaleReservedInvites(): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - INVITE_RESERVATION_TTL_MS);

  const released = await db
    .update(alphaInvites)
    .set({
      status: "pending",
      reservedAt: null,
      reservationNonceHash: null,
    })
    .where(
      and(
        eq(alphaInvites.targetPhase, ALPHA_STAGE_1_PHASE),
        eq(alphaInvites.status, "reserved"),
        lt(alphaInvites.reservedAt, cutoff),
      ),
    )
    .returning({ id: alphaInvites.id });

  return released.length;
}
