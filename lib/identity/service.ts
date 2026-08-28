import { IDENTITY_REQUEST_TTL_MS, type IdentityProvider, type IdentityRepository, type IdentityLimiter, type IdentityResult } from "@/lib/identity/contracts";

export function identityService(deps: { provider: IdentityProvider | null; repository: IdentityRepository; limit: IdentityLimiter; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return {
    async start(userId: string): Promise<IdentityResult> {
      const p = deps.provider;
      if (!p) return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      try {
        if (!await deps.limit("identityStart", userId) || !await deps.limit("identityGlobal", "global")) {
          return { ok: false, code: "TOO_MANY_REQUESTS" };
        }
        const request = await deps.repository.begin(userId, p.id, now());
        if (!request) return { ok: false, code: "PROFILE_REQUIRED" };
        const { url } = await p.start({ requestId: request.requestId });
        const destination = new URL(url);
        if (destination.protocol !== "https:" || destination.username || destination.password ||
          !p.allowedOrigins.includes(destination.origin)) return { ok: false, code: "PROVIDER_UNAVAILABLE" };
        return { ok: true, requestId: request.requestId, url };
      } catch {
        // Never log provider errors: they can contain name, phone, OTP or the provider response.
        return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      }
    },
    async complete(userId: string, requestId: string): Promise<IdentityResult> {
      const p = deps.provider;
      if (!p) return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      try {
        if (!await deps.limit("identityComplete", userId)) return { ok: false, code: "TOO_MANY_REQUESTS" };
        const request = await deps.repository.find(userId, requestId);
        const time = now();
        if (!request || request.provider !== p.id || request.expiresAt <= time || request.requestedAt > time) {
          return { ok: false, code: "VERIFICATION_FAILED" };
        }
        const proof = await p.verify(request.requestId);
        if (!proof || proof.requestId !== request.requestId || proof.realNameMatched !== true ||
          proof.phoneOwnershipVerified !== true || !Number.isFinite(proof.verifiedAt.getTime()) ||
          proof.verifiedAt < request.requestedAt || proof.verifiedAt > time ||
          time.getTime() - proof.verifiedAt.getTime() >= IDENTITY_REQUEST_TTL_MS) {
          return { ok: false, code: "VERIFICATION_FAILED" };
        }
        // Recheck ownership, revision, scope and expiry atomically after the provider round trip.
        if (!await deps.repository.complete(request, time)) return { ok: false, code: "VERIFICATION_FAILED" };
        return { ok: true, requestId };
      } catch {
        return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      }
    },
  };
}
