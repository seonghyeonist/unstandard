import "server-only";

import { eq } from "drizzle-orm";
import { isAnswersPersistenceEnabled } from "@/lib/config/answers-persistence-mode";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema/profiles";

export type ProfileSessionFields = {
  nickname?: string;
  onboarded: boolean;
};

export async function loadProfileSessionFields(userId: string): Promise<ProfileSessionFields | null> {
  if (!isAnswersPersistenceEnabled()) {
    return null;
  }

  const db = getDb();
  const [row] = await db
    .select({
      nickname: profiles.nickname,
      onboardedAt: profiles.onboardedAt,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!row) {
    return { onboarded: false };
  }

  return {
    nickname: row.nickname,
    onboarded: Boolean(row.onboardedAt),
  };
}
