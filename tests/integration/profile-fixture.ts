import { randomUUID } from "node:crypto";
import { profileBasics, identityVerifications } from "../../lib/db/schema/profile-basics";
import { PROFILE_CONSENT_VERSION, INTRODUCTION_SCOPE_VERSION, type Gender } from "../../lib/profile/basics";
import type { IntegrationDb } from "./helpers";
/** Synthetic fixtures only. Never imported by app code, seeds, or operational scripts. */
export async function addSyntheticVerifiedBasics(db: IntegrationDb, userId: string, gender: Gender) {
  if (process.env.DATABASE_ENV !== "test" || process.env.UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST !== "yes") throw new Error("Test-only fixture");
  const revision = randomUUID(); const now = new Date();
  await db.insert(profileBasics).values({ userId, gender, age: 22, region: "서울", introductionScopeAccepted: true,
    introductionScopeVersion: INTRODUCTION_SCOPE_VERSION, profileConsentVersion: PROFILE_CONSENT_VERSION,
    consentedAt: now, updatedAt: now, revision });
  await db.insert(identityVerifications).values({ userId, requestId: randomUUID(), profileRevision: revision,
    provider: "integration-fixture-only", noticeVersion: "alpha-identity-v1", status: "verified", requestedAt: now, verifiedAt: now, expiresAt: new Date(now.getTime() + 600000) });
}
