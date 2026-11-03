import "server-only";

import { incrementFunnel } from "@/lib/acquisition/acquisition.repository";
import { attributionFrom, type Attribution } from "@/lib/acquisition/policy";
import { and, eq } from "drizzle-orm";
import type { AlphaAcquisitionChannel } from "@/lib/alpha/stage1-policy";
import { getDb } from "@/lib/db/client";
import { waitlistEntries, waitlistVisitDays } from "@/lib/db/schema/waitlist";
import {
  generateWaitlistReceipt,
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
  attribution?: Attribution;
  existingToken?: string;
}): Promise<{ created: boolean; rawToken: string }> {
  const now = input.now ?? new Date();
  const rawToken = generateWaitlistReceipt();
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
    await incrementFunnel("waitlist_submit_accepted", input.attribution ?? attributionFrom({}), tx);
    if (!entry) {
      // Keep an already-authorized browser's deletion capability on resubmission.
      if (input.existingToken) {
        const [owned] = await tx.select({ id: waitlistEntries.id }).from(waitlistEntries)
          .where(and(eq(waitlistEntries.emailNormalized, input.email), eq(waitlistEntries.accessTokenHash, hashWaitlistToken(input.existingToken, requireWaitlistPepper())))).limit(1);
        if (owned) return { created: false, rawToken: input.existingToken };
      }
      return { created: false, rawToken };
    }
    await incrementFunnel("waitlist_created", input.attribution ?? attributionFrom({}), tx);

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
