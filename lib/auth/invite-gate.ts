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

export type InviteReserveResult =
  | { ok: true; inviteId: string; email: string; reservationCapability: string }
  | { ok: false; code: "INVALID" | "EXPIRED" | "REVOKED" | "CONSUMED" | "EMAIL_MISMATCH" };

export type InviteConsumeResult =
  | { ok: true }
  | { ok: false; code: "NOT_RESERVED" | "NONCE_MISMATCH" | "EXPIRED" | "ALREADY_CONSUMED" };

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
    })
    .from(alphaInvites)
    .where(eq(alphaInvites.id, ticket.inviteId))
    .limit(1);

  if (!invite) return false;
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
    .where(and(eq(alphaInvites.status, "reserved"), lt(alphaInvites.reservedAt, cutoff)))
    .returning({ id: alphaInvites.id });

  return released.length;
}
