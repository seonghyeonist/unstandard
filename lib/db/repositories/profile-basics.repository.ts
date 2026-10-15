import { IDENTITY_BIOMETRIC_CONSENT_VERSION, IDENTITY_NOTICE_VERSION } from "@/lib/identity/contracts";
import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { identityCompletionDeadline } from "@/lib/identity/completion-window";
import { profileBasics, identityVerifications } from "@/lib/db/schema/profile-basics";
import { profiles } from "@/lib/db/schema/profiles";
import { eligibleProfileSql } from "@/lib/db/repositories/introduction-policy";
import { IdentityInProgressError, type ProfileBasicsRepository } from "@/lib/server/profile/profile-basics.repository.interface";
import { assessProfileBasicsMutation } from "@/lib/profile/basics";
import type { Gender } from "@/lib/profile/basics";

export function createProfileBasicsRepository(database: typeof getDb = getDb): ProfileBasicsRepository {
  return {
    async read(userId) {
      const db = database();
      const [row] = await db.select({ basics: profileBasics, verification: identityVerifications, nickname: profiles.nickname,
        eligible: sql<boolean>`${eligibleProfileSql(sql`${userId}`)}`,
      }).from(profileBasics).innerJoin(profiles, eq(profiles.userId, profileBasics.userId))
        .leftJoin(identityVerifications, eq(identityVerifications.userId, profileBasics.userId))
        .where(eq(profileBasics.userId, userId)).limit(1);
      if (!row) return { basics: null, verification: "not_started", eligible: false };
      const v = row.verification;
      const status = !v || v.noticeVersion !== IDENTITY_NOTICE_VERSION || v.biometricConsentVersion !== IDENTITY_BIOMETRIC_CONSENT_VERSION || v.profileRevision !== row.basics.revision ? "not_started" :
        v.status === "verified" ? "verified" : v.status === "verified_unpurged" ? "purge_pending" : identityCompletionDeadline(v) <= new Date() ? "expired" : "pending";
      return { basics: { nickname: row.nickname, gender: row.basics.gender as Gender, age: row.basics.age,
        region: row.basics.region, introductionScopeAccepted: row.basics.introductionScopeAccepted,
        updatedAt: row.basics.updatedAt.toISOString() }, verification: status, eligible: row.eligible,
        pendingIdentityRequestId: status === "pending" || status === "purge_pending" ? v!.requestId : undefined };
    },
    async save(userId, input) {
      await database().transaction(async (tx) => {
        const locked = await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).for("update");
        if (!locked.length) throw new Error("Profile missing");
  
        const [stored] = await tx.select({
          basics: profileBasics,
          nickname: profiles.nickname,
          city: profiles.city,
        }).from(profileBasics).innerJoin(profiles, eq(profiles.userId, profileBasics.userId))
          .where(eq(profileBasics.userId, userId)).limit(1);
        const [verification] = await tx.select({ status: identityVerifications.status })
          .from(identityVerifications).where(eq(identityVerifications.userId, userId)).limit(1).for("update");
        const disposition = assessProfileBasicsMutation(stored ? {
          nickname: stored.nickname,
          city: stored.city,
          gender: stored.basics.gender,
          age: stored.basics.age,
          region: stored.basics.region,
          introductionScopeAccepted: stored.basics.introductionScopeAccepted,
          introductionScopeVersion: stored.basics.introductionScopeVersion,
          profileConsentVersion: stored.basics.profileConsentVersion,
        } : null, input, verification?.status ?? null);
        if (disposition === "unchanged") return;
        if (disposition === "blocked") throw new IdentityInProgressError();
  
        const now = new Date();
        const values = { userId, gender: input.gender, age: input.age, region: input.region,
          introductionScopeAccepted: input.introductionScopeAccepted,
          introductionScopeVersion: input.introductionScopeVersion, profileConsentVersion: input.profileConsentVersion,
          consentedAt: now, updatedAt: now, revision: randomUUID() };
        await tx.insert(profileBasics).values(values).onConflictDoUpdate({ target: profileBasics.userId, set: values });
        await tx.update(profiles).set({ nickname: input.nickname, city: input.region, updatedAt: now }).where(eq(profiles.userId, userId));
        await tx.delete(identityVerifications).where(eq(identityVerifications.userId, userId));
      });
    },
    async withdraw(userId) {
      await database().transaction(async (tx) => {
        await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).for("update");
        await tx.delete(profileBasics).where(eq(profileBasics.userId, userId));
        await tx.update(profiles).set({ city: null, updatedAt: new Date() }).where(eq(profiles.userId, userId));
      });
    },
    };
}

export const profileBasicsRepository = createProfileBasicsRepository();
