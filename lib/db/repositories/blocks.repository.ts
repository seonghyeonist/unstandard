import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { lockConversationPair } from "@/lib/db/repositories/conversation-lock";
import { blocks } from "@/lib/db/schema/blocks";
import { profiles } from "@/lib/db/schema/profiles";
import { translateDatabaseError } from "@/lib/db/errors";
import { isUuid } from "@/lib/server/unlock/uuid";

export type CreateBlockInput = {
  blockerUserId: string;
  blockedUserId: string;
};

export type CreateBlockResult =
  | { ok: true; blockId: string; inserted: boolean }
  | { ok: false; code: "SELF_BLOCK" | "DB_ERROR" };

export type CreateBlockForProfileResult =
  | { ok: true; inserted: boolean }
  | { ok: false; code: "INVALID_PROFILE_ID" | "PROFILE_NOT_FOUND" | "SELF_BLOCK" | "DB_ERROR" };

export async function createBlock(input: CreateBlockInput): Promise<CreateBlockResult> {
  if (input.blockerUserId === input.blockedUserId) {
    return { ok: false, code: "SELF_BLOCK" };
  }

  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      await lockConversationPair(tx, input.blockerUserId, input.blockedUserId);
      const [row] = await tx
        .insert(blocks)
        .values({
          blockerUserId: input.blockerUserId,
          blockedUserId: input.blockedUserId,
        })
        .returning({ id: blocks.id });

      if (!row) return { ok: false as const, code: "DB_ERROR" as const };
      return { ok: true as const, blockId: row.id, inserted: true as const };
    });
  } catch (error) {
    const translated = translateDatabaseError(error);
    if (translated.code === "UNIQUE_VIOLATION") {
      const [existing] = await db
        .select({ id: blocks.id })
        .from(blocks)
        .where(
          and(
            eq(blocks.blockerUserId, input.blockerUserId),
            eq(blocks.blockedUserId, input.blockedUserId),
          ),
        )
        .limit(1);
      if (existing) {
        return { ok: true, blockId: existing.id, inserted: false };
      }
    }
    return { ok: false, code: "DB_ERROR" };
  }
}

export async function createBlockForProfile(input: {
  blockerUserId: string;
  targetProfileId: string;
}): Promise<CreateBlockForProfileResult> {
  if (!isUuid(input.targetProfileId)) return { ok: false, code: "INVALID_PROFILE_ID" };

  let target: { userId: string } | undefined;
  try {
    [target] = await getDb()
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(eq(profiles.id, input.targetProfileId))
      .limit(1);
  } catch {
    return { ok: false, code: "DB_ERROR" };
  }
  if (!target) return { ok: false, code: "PROFILE_NOT_FOUND" };

  const result = await createBlock({
    blockerUserId: input.blockerUserId,
    blockedUserId: target.userId,
  });
  return result.ok ? { ok: true, inserted: result.inserted } : result;
}
