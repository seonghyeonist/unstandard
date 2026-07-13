import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { alphaInvites } from "@/lib/db/schema/invites";
import { hashInviteCode, normalizeEmail, requireInvitePepper } from "@/lib/auth/invite-crypto";

export type InviteClaimResult =
  | { ok: true; inviteId: string; email: string }
  | { ok: false; code: "INVALID" | "EXPIRED" | "REVOKED" | "CONSUMED" | "EMAIL_MISMATCH" };

export async function claimInviteForEmail(
  rawCode: string,
  email: string,
): Promise<InviteClaimResult> {
  const pepper = requireInvitePepper();
  const codeHash = hashInviteCode(rawCode, pepper);
  const emailNormalized = normalizeEmail(email);
  const db = getDb();

  const [invite] = await db
    .select()
    .from(alphaInvites)
    .where(eq(alphaInvites.codeHash, codeHash))
    .limit(1);

  if (!invite) {
    return { ok: false, code: "INVALID" };
  }

  if (invite.emailNormalized !== emailNormalized) {
    return { ok: false, code: "EMAIL_MISMATCH" };
  }

  if (invite.status === "revoked") {
    return { ok: false, code: "REVOKED" };
  }

  if (invite.status === "consumed") {
    return { ok: false, code: "CONSUMED" };
  }

  if (invite.expiresAt.getTime() < Date.now() || invite.status === "expired") {
    return { ok: false, code: "EXPIRED" };
  }

  const now = new Date();
  const reserved = await db
    .update(alphaInvites)
    .set({ status: "reserved", reservedAt: now })
    .where(eq(alphaInvites.id, invite.id))
    .returning({ id: alphaInvites.id });

  if (!reserved.length) {
    return { ok: false, code: "INVALID" };
  }

  return { ok: true, inviteId: invite.id, email: emailNormalized };
}

export async function consumeInviteForUser(inviteId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const result = await db
    .update(alphaInvites)
    .set({
      status: "consumed",
      consumedAt: now,
      consumedByUserId: userId,
    })
    .where(eq(alphaInvites.id, inviteId))
    .returning({ id: alphaInvites.id });

  return result.length > 0;
}

export async function releaseStaleReservedInvites(): Promise<number> {
  return 0;
}
