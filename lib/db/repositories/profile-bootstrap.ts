import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { DbExecutor } from "@/lib/db/types";
import { profiles } from "@/lib/db/schema/profiles";
import type { AuthenticatedUser } from "@/lib/auth/server";
import { resolveReporterNickname } from "@/lib/server/profile/reporter-nickname";

export async function ensureProfileForUser(
  user: AuthenticatedUser,
  db: DbExecutor = getDb(),
): Promise<{
  profileId: string;
  nickname: string;
  onboarded: boolean;
}> {
  const nickname = resolveReporterNickname(user);

  const existing = await db
    .select({
      id: profiles.id,
      nickname: profiles.nickname,
      onboardedAt: profiles.onboardedAt,
    })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  if (existing[0]) {
    return {
      profileId: existing[0].id,
      nickname: existing[0].nickname,
      onboarded: Boolean(existing[0].onboardedAt),
    };
  }

  const inserted = await db
    .insert(profiles)
    .values({
      userId: user.id,
      nickname,
    })
    .onConflictDoNothing({ target: profiles.userId })
    .returning({
      id: profiles.id,
      nickname: profiles.nickname,
      onboardedAt: profiles.onboardedAt,
    });

  if (inserted[0]) {
    return {
      profileId: inserted[0].id,
      nickname: inserted[0].nickname,
      onboarded: Boolean(inserted[0].onboardedAt),
    };
  }

  const reconciled = await db
    .select({
      id: profiles.id,
      nickname: profiles.nickname,
      onboardedAt: profiles.onboardedAt,
    })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  if (!reconciled[0]) {
    throw new Error("Profile bootstrap failed");
  }

  return {
    profileId: reconciled[0].id,
    nickname: reconciled[0].nickname,
    onboarded: Boolean(reconciled[0].onboardedAt),
  };
}
