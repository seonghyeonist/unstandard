import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db/client.mts";
import { cards, members, orders, rooms, sessions } from "../db/schema.mts";
import { entitlementExpiresAt } from "./session.mts";

type Operation =
  | {type: "room"; roomId: string}
  | {type: "card"}
  | {type: "locale"; roomId: string; revision: number; locale: "en" | "ko"};

export function createRepository(db: Database, clock = () => new Date()) {
  return {
    async access(digest: string, operation: Operation) {
      return db.transaction(async (tx) => {
        const [owner] = await tx.select({
          roomId: rooms.id,
          roomExpiresAt: rooms.expiresAt,
          roomRevokedAt: rooms.revokedAt,
          state: orders.state,
          paidAt: orders.paidAt,
          memberId: members.id,
          memberRevokedAt: members.revokedAt,
          role: members.role,
          locale: members.locale,
          revision: members.revision,
          sessionExpiresAt: sessions.expiresAt,
          sessionRevokedAt: sessions.revokedAt,
        }).from(sessions)
          .innerJoin(members, eq(sessions.memberId, members.id))
          .innerJoin(rooms, eq(members.roomId, rooms.id))
          .innerJoin(orders, eq(rooms.orderId, orders.id))
          .where(eq(sessions.digest, digest))
          .for(operation.type === "locale" ? "update" : "share");
        const now = clock();
        if (!owner || owner.sessionRevokedAt || owner.sessionExpiresAt <= now || owner.memberRevokedAt) {
          return {status: 401, body: {error: "unauthenticated"}};
        }
        if (operation.type !== "card" && operation.roomId !== owner.roomId) {
          return {status: 404, body: {error: "not_found"}};
        }
        if (owner.roomRevokedAt || owner.state !== "paid" || !owner.paidAt) {
          return {status: 410, body: {error: "inactive_room"}};
        }
        const expiresAt = entitlementExpiresAt(owner.paidAt, owner.roomExpiresAt);
        if (expiresAt <= now) return {status: 410, body: {error: "inactive_room"}};
        if (operation.type === "card") {
          const [card] = await tx.select({revision: cards.revision, payload: cards.payload}).from(cards)
            .where(and(eq(cards.roomId, owner.roomId), eq(cards.kind, "personal"), eq(cards.ownerMemberId, owner.memberId)))
            .orderBy(desc(cards.revision)).limit(1);
          return card ? {status: 200, body: card} : {status: 202, body: {state: "pending"}};
        }

        const room = {
          id: owner.roomId,
          expiresAt,
          member: {role: owner.role, locale: owner.locale, revision: owner.revision},
        };
        if (operation.type === "room") return {status: 200, body: room};

        const nextRevision = operation.revision + 1;
        const [updated] = await tx.update(members).set({locale: operation.locale, revision: nextRevision})
          .where(and(eq(members.roomId, owner.roomId), eq(members.id, owner.memberId), eq(members.revision, operation.revision)))
          .returning({revision: members.revision});
        if (!updated) return {status: 409, body: {error: "stale_revision"}};
        return {status: 200, body: {...room, member: {...room.member, locale: operation.locale, revision: updated.revision}}};
      });
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
