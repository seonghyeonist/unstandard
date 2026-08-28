export const IDENTITY_NOTICE_VERSION = "alpha-identity-v1";
export const IDENTITY_REQUEST_TTL_MS = 10 * 60 * 1000;
export type IdentityRequest = {
  userId: string; requestId: string; profileRevision: string; provider: string;
  requestedAt: Date; expiresAt: Date; status: "pending" | "verified";
};
/** Provider adapter must query the canonical server API, never trust browser success fields.
 * Raw name/phone are entered on the provider's hosted UI and must not enter this contract.
 * Approval requires BOTH real-name matching and phone possession, not SMS alone.
 */
export interface IdentityProvider {
  readonly id: string;
  readonly allowedOrigins: readonly string[];
  start(input: { requestId: string }): Promise<{ url: string }>;
  verify(requestId: string): Promise<null | {
    requestId: string; verifiedAt: Date; realNameMatched: boolean; phoneOwnershipVerified: boolean;
  }>;
}
export interface IdentityRepository {
  begin(userId: string, provider: string, now: Date): Promise<IdentityRequest | null>;
  find(userId: string, requestId: string): Promise<IdentityRequest | null>;
  complete(request: IdentityRequest, now: Date): Promise<boolean>;
}
export type IdentityResult =
  | { ok: true; requestId: string; url?: string }
  | { ok: false; code: "PROVIDER_UNAVAILABLE" | "PROFILE_REQUIRED" | "VERIFICATION_FAILED" | "TOO_MANY_REQUESTS" };
export type IdentityLimiter = (scope: "identityStart" | "identityComplete" | "identityGlobal", subject: string) => Promise<boolean>;
