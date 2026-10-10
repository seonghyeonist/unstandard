import { randomUUID } from "node:crypto";
import { IDENTITY_BIOMETRIC_CONSENT_VERSION, IDENTITY_NOTICE_VERSION } from "../../lib/identity/contracts";
import { profileBasics, identityVerifications } from "../../lib/db/schema/profile-basics";
import { PROFILE_CONSENT_VERSION, INTRODUCTION_SCOPE_VERSION, type Gender } from "../../lib/profile/basics";
import type { IntegrationDb } from "./helpers";
/** Synthetic fixtures only. Never imported by app code, seeds, or operational scripts. */
export async function addSyntheticProfileBasics(db: IntegrationDb, userId: string, gender: Gender) {
  if (process.env.DATABASE_ENV !== "test" || process.env.UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST !== "yes") throw new Error("Test-only fixture");
  const revision = randomUUID(); const now = new Date();
  await db.insert(profileBasics).values({ userId, gender, age: 22, region: "서울", introductionScopeAccepted: true,
    introductionScopeVersion: INTRODUCTION_SCOPE_VERSION, profileConsentVersion: PROFILE_CONSENT_VERSION,
    consentedAt: now, updatedAt: now, revision });
  return { revision, now };
}

export async function addSyntheticVerifiedBasics(db: IntegrationDb, userId: string, gender: Gender) {
  const { revision, now } = await addSyntheticProfileBasics(db, userId, gender);
  await db.insert(identityVerifications).values({ userId, requestId: randomUUID(), profileRevision: revision,
    provider: "integration-fixture-only", providerReference: randomUUID(), biometricConsentVersion: IDENTITY_BIOMETRIC_CONSENT_VERSION,
    noticeVersion: IDENTITY_NOTICE_VERSION, status: "verified", requestedAt: now, verifiedAt: now,
    providerPurgedAt: now, expiresAt: new Date(now.getTime() + 600000) });
}
