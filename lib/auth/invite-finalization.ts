import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";

export async function isUserInviteFinalized(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ inviteFinalizedAt: users.inviteFinalizedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return Boolean(row?.inviteFinalizedAt);
}

export async function markUserInviteFinalized(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({ inviteFinalizedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function compensateFailedRegistration(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(users).where(eq(users.id, userId));
}
