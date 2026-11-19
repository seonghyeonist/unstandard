import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Transaction } from "../db/client.mts";
import { members, orders, rooms, sessions } from "../db/schema.mts";

export const cookieName = "__Host-b2c_session";
const dayMs = 24 * 60 * 60 * 1_000;
export const roomLifetimeMs = 14 * dayMs;
const sessionLifetimeSeconds = 15 * dayMs / 1_000;

export function entitlementExpiresAt(paidAt: Date, roomExpiresAt: Date) {
  // A room may close sooner, but never later than the original paid entitlement.
  return new Date(Math.min(paidAt.getTime() + roomLifetimeMs, roomExpiresAt.getTime()));
}

export function digestToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function readSessionCookie(header: string | undefined) {
  const matching = header?.split(";").map((cookie) => cookie.trim()).filter(
    (cookie) => cookie.split("=", 1)[0] === cookieName,
  );
  if (matching?.length !== 1) return null;
  const value = matching[0].slice(cookieName.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? digestToken(value) : null;
}

// Call from a trusted, entitlement-creating transaction (P2 or a test fixture).
// No HTTP handler issues sessions in P1.
export async function issueSession(tx: Transaction, memberId: string, clock = () => new Date()) {
  const [owner] = await tx.select({
    revokedMemberAt: members.revokedAt,
    revokedRoomAt: rooms.revokedAt,
    expiresAt: rooms.expiresAt,
    state: orders.state,
    paidAt: orders.paidAt,
  }).from(members).innerJoin(rooms, eq(members.roomId, rooms.id))
    .innerJoin(orders, eq(rooms.orderId, orders.id))
    .where(eq(members.id, memberId)).for("update");
  const now = clock();
  if (!owner || owner.state !== "paid" || !owner.paidAt || owner.revokedMemberAt ||
      owner.revokedRoomAt || entitlementExpiresAt(owner.paidAt, owner.expiresAt) <= now) {
    throw new Error("Inactive B2C membership");
  }
  const token = randomBytes(32).toString("base64url");
  await tx.insert(sessions).values({
    digest: digestToken(token),
    memberId,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + sessionLifetimeSeconds * 1_000),
  });
  return `${cookieName}=${token}; Path=/; Max-Age=${sessionLifetimeSeconds}; Secure; HttpOnly; SameSite=Lax`;
}

export async function revokeSession(tx: Transaction, digest: string, now: Date) {
  await tx.update(sessions).set({revokedAt: now}).where(and(eq(sessions.digest, digest), isNull(sessions.revokedAt)));
}
