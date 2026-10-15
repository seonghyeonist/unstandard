import "server-only";

import { and, desc, eq, or, sql } from "drizzle-orm";
import { canAccessIntroduction, lockIntroductionProfiles, introductionPairSql } from "@/lib/db/repositories/introduction-policy";
import { getDb } from "@/lib/db/client";
import { lockConversationPair } from "@/lib/db/repositories/conversation-lock";
import { blocks } from "@/lib/db/schema/blocks";
import { messages } from "@/lib/db/schema/messages";
import { profiles } from "@/lib/db/schema/profiles";
import { unlocks } from "@/lib/db/schema/unlocks";
import { isUuid } from "@/lib/server/unlock/uuid";
import type { DbExecutor } from "@/lib/db/types";

export type ConversationMessage = {
  id: string;
  profileId: string;
  author: "me" | "them";
  body: string;
  createdAt: string;
};

export type ConversationError =
  | "INVALID_PROFILE_ID"
  | "PROFILE_NOT_FOUND"
  | "SELF_MESSAGE"
  | "NOT_ONBOARDED"
  | "NOT_UNLOCKED"
  | "BLOCKED"
  | "PROFILE_SETUP_REQUIRED";

type AuthorizationResult =
  | { ok: true; targetUserId: string }
  | { ok: false; code: ConversationError };

async function authorizeConversation(
  viewerUserId: string,
  targetProfileId: string,
  db: DbExecutor = getDb(),
  lockForWrite = false,
): Promise<AuthorizationResult> {
  if (!isUuid(targetProfileId)) return { ok: false, code: "INVALID_PROFILE_ID" };

  if (lockForWrite) await lockIntroductionProfiles(db, viewerUserId, targetProfileId);

  const [target] = await db
    .select({ userId: profiles.userId, onboardedAt: profiles.onboardedAt })
    .from(profiles)
    .where(eq(profiles.id, targetProfileId))
    .limit(1);
  if (!target) return { ok: false, code: "PROFILE_NOT_FOUND" };
  if (!target.onboardedAt) return { ok: false, code: "NOT_ONBOARDED" };
  if (target.userId === viewerUserId) return { ok: false, code: "SELF_MESSAGE" };
  if (lockForWrite) await lockConversationPair(db, viewerUserId, target.userId);

  const [viewerProfile] = await db
    .select({ id: profiles.id, onboardedAt: profiles.onboardedAt })
    .from(profiles)
    .where(eq(profiles.userId, viewerUserId))
    .limit(1);
  if (!viewerProfile?.onboardedAt) return { ok: false, code: "NOT_ONBOARDED" };

  const [block] = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerUserId, viewerUserId), eq(blocks.blockedUserId, target.userId)),
        and(eq(blocks.blockerUserId, target.userId), eq(blocks.blockedUserId, viewerUserId)),
      ),
    )
    .limit(1);
  if (block) return { ok: false, code: "BLOCKED" };

  if (!await canAccessIntroduction(viewerUserId, targetProfileId, db)) return { ok: false, code: "PROFILE_SETUP_REQUIRED" };

  const [unlock] = await db
    .select({ id: unlocks.id })
    .from(unlocks)
    .where(
      or(
        and(eq(unlocks.viewerUserId, viewerUserId), eq(unlocks.profileId, targetProfileId)),
        and(eq(unlocks.viewerUserId, target.userId), eq(unlocks.profileId, viewerProfile.id)),
      ),
    )
    .limit(1);
  if (!unlock) return { ok: false, code: "NOT_UNLOCKED" };

  return { ok: true, targetUserId: target.userId };
}

export async function listConversation(input: {
  viewerUserId: string;
  targetProfileId: string;
}): Promise<{ ok: true; messages: ConversationMessage[] } | { ok: false; code: ConversationError }> {
  const authorization = await authorizeConversation(input.viewerUserId, input.targetProfileId);
  if (!authorization.ok) return authorization;

  const rows = await getDb()
    .select({
      id: messages.id,
      senderUserId: messages.senderUserId,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(introductionPairSql(input.viewerUserId, sql`${authorization.targetUserId}`), or(
        and(
          eq(messages.senderUserId, input.viewerUserId),
          eq(messages.recipientUserId, authorization.targetUserId),
        ),
        and(
          eq(messages.senderUserId, authorization.targetUserId),
          eq(messages.recipientUserId, input.viewerUserId),
        ),
      )),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(200);

  return {
    ok: true,
    messages: rows.reverse().map((row) => ({
      id: row.id,
      profileId: input.targetProfileId,
      author: row.senderUserId === input.viewerUserId ? "me" : "them",
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function createMessage(input: {
  viewerUserId: string;
  targetProfileId: string;
  body: string;
}): Promise<{ ok: true; message: ConversationMessage } | { ok: false; code: ConversationError }> {
  return getDb().transaction(async (tx) => {
    const authorization = await authorizeConversation(
      input.viewerUserId,
      input.targetProfileId,
      tx,
      true,
    );
    if (!authorization.ok) return authorization;

    const [row] = await tx
      .insert(messages)
      .values({
        senderUserId: input.viewerUserId,
        recipientUserId: authorization.targetUserId,
        body: input.body,
      })
      .returning({ id: messages.id, body: messages.body, createdAt: messages.createdAt });
    if (!row) throw new Error("message insert returned no row");

    return {
      ok: true as const,
      message: {
        id: row.id,
        profileId: input.targetProfileId,
        author: "me" as const,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      },
    };
  });
}
