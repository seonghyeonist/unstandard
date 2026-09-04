import { IDENTITY_BIOMETRIC_CONSENT_VERSION, IDENTITY_NOTICE_VERSION } from "@/lib/identity/contracts";
import { z } from "zod";

export const PROFILE_CONSENT_VERSION = "alpha-basic-profile-v1";
export const INTRODUCTION_SCOPE_VERSION = "alpha-opposite-gender-v1";
export const PROFILE_FRESHNESS_MS = 365 * 24 * 60 * 60 * 1000;
export const ACTIVITY_REGIONS = [
  "서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
] as const;
export const profileBasicsSchema = z.object({
  nickname: z.string().trim().min(1).max(16),
  gender: z.enum(["male", "female"]),
  age: z.number().int().min(19).max(120),
  region: z.enum(ACTIVITY_REGIONS),
  introductionScopeAccepted: z.boolean(),
  profileConsentAccepted: z.literal(true),
  profileConsentVersion: z.literal(PROFILE_CONSENT_VERSION),
  introductionScopeVersion: z.literal(INTRODUCTION_SCOPE_VERSION),
}).strict();
export type ProfileBasicsInput = z.infer<typeof profileBasicsSchema>;
export type Gender = ProfileBasicsInput["gender"];
export type BasicProfile = {
  nickname: string; gender: Gender; age: number; region: string;
  introductionScopeAccepted: boolean; updatedAt: string;
};
export type ProfileSetupView = {
  basics: BasicProfile | null;
  eligible: boolean;
  verification: "not_started" | "pending" | "purge_pending" | "verified" | "expired";
  verificationAvailable: boolean;
  pendingIdentityRequestId?: string;
};

// Shared, pure policy used by service tests. SQL enforces the same conditions at read/write boundaries.
export type EligibilityFacts = {
  gender: string | null; age: number | null; region: string | null;
  profileConsentVersion: string | null; introductionScopeVersion: string | null;
  introductionScopeAccepted: boolean; updatedAt: Date | null; onboarded: boolean;
  identityNoticeVersion: string | null;
  identityBiometricConsentVersion: string | null;
  identityStatus: "pending" | "verified_unpurged" | "verified" | null;
  providerReference: string | null; providerPurgedAt: Date | null;
  revision: string | null; verifiedRevision: string | null; verifiedAt: Date | null;
};
export function isIntroductionEligible(f: EligibilityFacts, now = new Date()): boolean {
  return (f.gender === "male" || f.gender === "female") && Number.isInteger(f.age) &&
    f.age! >= 19 && f.age! <= 120 && ACTIVITY_REGIONS.includes(f.region as typeof ACTIVITY_REGIONS[number]) &&
    f.profileConsentVersion === PROFILE_CONSENT_VERSION &&
    f.introductionScopeVersion === INTRODUCTION_SCOPE_VERSION && f.introductionScopeAccepted &&
    f.identityNoticeVersion === IDENTITY_NOTICE_VERSION && f.identityBiometricConsentVersion === IDENTITY_BIOMETRIC_CONSENT_VERSION &&
    f.identityStatus === "verified" && !!f.providerReference &&
    f.onboarded && !!f.revision && f.revision === f.verifiedRevision && !!f.verifiedAt &&
    !!f.providerPurgedAt && f.providerPurgedAt >= f.verifiedAt && f.providerPurgedAt <= now &&
    !!f.updatedAt && f.updatedAt <= now && now.getTime() - f.updatedAt.getTime() < PROFILE_FRESHNESS_MS &&
    f.verifiedAt <= now;
}
export function canIntroduce(a: EligibilityFacts, b: EligibilityFacts, now = new Date()): boolean {
  return isIntroductionEligible(a, now) && isIntroductionEligible(b, now) && a.gender !== b.gender;
}
