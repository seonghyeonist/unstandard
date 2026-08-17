import "server-only";

import { getDb } from "@/lib/db/client";
import { alphaActivityDays } from "@/lib/db/schema/alpha-activity";
import type { DbExecutor } from "@/lib/db/types";

export function utcActivityDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** One idempotent, content-free presence row per authenticated user per UTC day. */
export async function recordAlphaActivityDay(
  userId: string,
  db: DbExecutor = getDb(),
  now = new Date(),
): Promise<void> {
  const activityDate = utcActivityDate(now);
  await db
    .insert(alphaActivityDays)
    .values({ userId, activityDate })
    .onConflictDoNothing({
      target: [alphaActivityDays.userId, alphaActivityDays.activityDate],
    });
}
