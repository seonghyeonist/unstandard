import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { lockConversationPair } from "@/lib/db/repositories/conversation-lock";
import { blocks } from "@/lib/db/schema/blocks";
import { translateDatabaseError } from "@/lib/db/errors";

export type CreateBlockInput = {
  blockerUserId: string;
  blockedUserId: string;
};

export type CreateBlockResult =
  | { ok: true; blockId: string; inserted: boolean }
  | { ok: false; code: "SELF_BLOCK" | "DUPLICATE" | "DB_ERROR" };

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
      return { ok: false, code: "DUPLICATE" };
    }
    return { ok: false, code: "DB_ERROR" };
  }
}
