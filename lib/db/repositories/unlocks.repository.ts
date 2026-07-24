import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { unlocks } from "@/lib/db/schema/unlocks";
import { translateDatabaseError } from "@/lib/db/errors";

export type CreateUnlockInput = {
  viewerUserId: string;
  profileId: string;
};

export type CreateUnlockResult =
  | { ok: true; unlockId: string; inserted: boolean }
  | { ok: false; code: "DUPLICATE" | "DB_ERROR" };

export async function createUnlock(input: CreateUnlockInput): Promise<CreateUnlockResult> {
  const db = getDb();

  try {
    const [row] = await db
      .insert(unlocks)
      .values({
        viewerUserId: input.viewerUserId,
        profileId: input.profileId,
      })
      .returning({ id: unlocks.id });

    if (!row) {
      return { ok: false, code: "DB_ERROR" };
    }

    return { ok: true, unlockId: row.id, inserted: true };
  } catch (error) {
    const translated = translateDatabaseError(error);
    if (translated.code === "UNIQUE_VIOLATION") {
      const [existing] = await db
        .select({ id: unlocks.id })
        .from(unlocks)
        .where(
          and(
            eq(unlocks.viewerUserId, input.viewerUserId),
            eq(unlocks.profileId, input.profileId),
          ),
        )
        .limit(1);
      if (existing) {
        return { ok: true, unlockId: existing.id, inserted: false };
      }
      return { ok: false, code: "DUPLICATE" };
    }
    return { ok: false, code: "DB_ERROR" };
  }
}

export async function hasUnlock(viewerUserId: string, profileId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: unlocks.id })
    .from(unlocks)
    .where(and(eq(unlocks.viewerUserId, viewerUserId), eq(unlocks.profileId, profileId)))
    .limit(1);
  return Boolean(row);
}
