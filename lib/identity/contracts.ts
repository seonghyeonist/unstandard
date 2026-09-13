import { z } from "zod";

export const IDENTITY_NOTICE_VERSION = "alpha-identity-v1";
export const IDENTITY_BIOMETRIC_CONSENT_VERSION = "alpha-biometric-identity-v1";
export const IDENTITY_REQUEST_TTL_MS = 10 * 60 * 1000;
export const identityRequestIdSchema = z.string().uuid();
export const identityProviderReferenceSchema = z.string().uuid();

const diditHostedUrlSchema = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "verify.didit.me";
  } catch {
    return false;
  }
}, "Unexpected identity provider URL");

export const identityLaunchSchema = z.object({
  type: z.literal("didit"),
  providerReference: identityProviderReferenceSchema,
  url: diditHostedUrlSchema,
}).strict();
export type IdentityLaunch = z.infer<typeof identityLaunchSchema>;
export type IdentityRequest = {
  userId: string;
  requestId: string;
  profileRevision: string;
  provider: string;
  providerReference: string | null;
  biometricConsentVersion: string;
  requestedAt: Date;
  expiresAt: Date;
  verifiedAt: Date | null;
  providerPurgedAt: Date | null;
  status: "pending" | "verified_unpurged" | "verified";
};

export type IdentityProof = {
  requestId: string;
  providerReference: string;
  verifiedAt: Date;
  documentVerified: boolean;
  livenessVerified: boolean;
  faceMatchVerified: boolean;
  deviceIpVerified: boolean;
  adultVerified: boolean;
};

/** The adapter owns provider response parsing. The service only sees this proof. */
export interface IdentityProvider {
  readonly id: string;
  start(input: { requestId: string }): Promise<IdentityLaunch>;
  verify(input: { requestId: string; providerReference: string }): Promise<IdentityProof | null>;
  purge(input: { requestId: string; providerReference: string }): Promise<boolean>;
}
export interface IdentityRepository {
  begin(userId: string, provider: string, biometricConsentVersion: string, now: Date): Promise<IdentityRequest | null>;
  removePending(request: IdentityRequest): Promise<boolean>;
  findCurrent(userId: string): Promise<IdentityRequest | null>;
  find(userId: string, requestId: string): Promise<IdentityRequest | null>;
  findByProviderReference(providerReference: string): Promise<IdentityRequest | null>;
  bindProviderReference(request: IdentityRequest, providerReference: string): Promise<boolean>;
  markVerifiedUnpurged(request: IdentityRequest, proof: IdentityProof, now: Date): Promise<boolean>;
  markVerified(request: IdentityRequest, purgedAt: Date): Promise<boolean>;
}
export type IdentityResult =
  | { ok: true; requestId: string; launch?: IdentityLaunch }
  | { ok: false; code: "PROVIDER_UNAVAILABLE" | "PROFILE_REQUIRED" | "VERIFICATION_FAILED" | "PURGE_PENDING" | "TOO_MANY_REQUESTS" };
export type IdentityLimiter = (scope: "identityStart" | "identityComplete" | "identityGlobal", subject: string) => Promise<boolean>;
