import "server-only";

import { eq } from "drizzle-orm";
import type { AlphaAcquisitionChannel } from "@/lib/alpha/stage1-policy";
import { getDb } from "@/lib/db/client";
import { waitlistEntries, waitlistVisitDays } from "@/lib/db/schema/waitlist";
import {
  generateWaitlistToken,
  hashWaitlistToken,
  requireWaitlistPepper,
} from "@/lib/waitlist/waitlist-token";

function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function joinWaitlist(input: {
  email: string;
  acquisitionChannel: AlphaAcquisitionChannel;
  now?: Date;
}): Promise<{ created: true; rawToken: string } | { created: false }> {
  const now = input.now ?? new Date();
  const rawToken = generateWaitlistToken();
  const accessTokenHash = hashWaitlistToken(rawToken, requireWaitlistPepper());
  const db = getDb();

  return db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(waitlistEntries)
      .values({
        emailNormalized: input.email,
        acquisitionChannel: input.acquisitionChannel,
        accessTokenHash,
        consentedAt: now,
        createdAt: now,
      })
      .onConflictDoNothing({ target: waitlistEntries.emailNormalized })
      .returning({ id: waitlistEntries.id });
    if (!entry) return { created: false };

    await tx.insert(waitlistVisitDays).values({
      waitlistEntryId: entry.id,
      visitDate: utcDate(now),
    });
    return { created: true, rawToken };
  });
}

export async function recordWaitlistVisit(rawToken: string, now = new Date()): Promise<boolean> {
  const tokenHash = hashWaitlistToken(rawToken, requireWaitlistPepper());
  const db = getDb();
  const [entry] = await db
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.accessTokenHash, tokenHash))
    .limit(1);
  if (!entry) return false;

  await db
    .insert(waitlistVisitDays)
    .values({ waitlistEntryId: entry.id, visitDate: utcDate(now) })
    .onConflictDoNothing({
      target: [waitlistVisitDays.waitlistEntryId, waitlistVisitDays.visitDate],
    });
  return true;
}

export async function deleteWaitlistEntry(rawToken: string): Promise<boolean> {
  const tokenHash = hashWaitlistToken(rawToken, requireWaitlistPepper());
  const removed = await getDb()
    .delete(waitlistEntries)
    .where(eq(waitlistEntries.accessTokenHash, tokenHash))
    .returning({ id: waitlistEntries.id });
  return removed.length === 1;
}
