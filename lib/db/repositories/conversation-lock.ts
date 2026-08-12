import "server-only";

import { sql } from "drizzle-orm";
import type { DbExecutor } from "@/lib/db/types";

/**
 * Serializes block creation and message sends for one unordered user pair.
 * Both repository write paths must take this transaction lock before checking
 * or changing the relationship. A hash collision only adds serialization; it
 * cannot grant access.
 */
export async function lockConversationPair(
  db: DbExecutor,
  userA: string,
  userB: string,
): Promise<void> {
  const [left, right] = userA < userB ? [userA, userB] : [userB, userA];
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`unstandard:conversation:${left}:${right}`}))`,
  );
}
