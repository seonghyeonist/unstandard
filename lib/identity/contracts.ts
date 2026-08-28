import { z } from "zod";

export const IDENTITY_NOTICE_VERSION = "alpha-identity-v1";
export const IDENTITY_REQUEST_TTL_MS = 10 * 60 * 1000;
export const identityRequestIdSchema = z.string().uuid();
export const identityLaunchSchema = z.object({
  type: z.literal("portone"),
  storeId: z.string().regex(/^store-[0-9a-f-]{36}$/i),
  channelKey: z.string().regex(/^channel-key-[0-9a-f-]{36}$/i),
  identityVerificationId: identityRequestIdSchema,
}).strict();
export type IdentityLaunch = z.infer<typeof identityLaunchSchema>;
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
  start(input: { requestId: string }): Promise<IdentityLaunch>;
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
  | { ok: true; requestId: string; launch?: IdentityLaunch }
  | { ok: false; code: "PROVIDER_UNAVAILABLE" | "PROFILE_REQUIRED" | "VERIFICATION_FAILED" | "TOO_MANY_REQUESTS" };
export type IdentityLimiter = (scope: "identityStart" | "identityComplete" | "identityGlobal", subject: string) => Promise<boolean>;
