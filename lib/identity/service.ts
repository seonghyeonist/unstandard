import {
  IDENTITY_BIOMETRIC_CONSENT_VERSION,
  IDENTITY_REQUEST_TTL_MS,
  identityLaunchSchema,
  type IdentityProvider,
  type IdentityRepository,
  type IdentityLimiter,
  type IdentityProof,
  type IdentityResult,
} from "@/lib/identity/contracts";

export function identityService(deps: { provider: IdentityProvider | null; repository: IdentityRepository; limit: IdentityLimiter; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  function hasCompleteProof(proof: IdentityProof, request: { requestId: string; providerReference: string }, completedAt: Date): boolean {
    return proof.requestId === request.requestId && proof.providerReference === request.providerReference &&
      proof.documentVerified === true && proof.livenessVerified === true && proof.faceMatchVerified === true &&
      proof.deviceIpVerified === true && proof.adultVerified === true &&
      Number.isFinite(proof.verifiedAt.getTime()) && proof.verifiedAt >= new Date(0) && proof.verifiedAt <= completedAt;
  }

  return {
    async start(userId: string): Promise<IdentityResult> {
      const p = deps.provider;
      if (!p) return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      try {
        if (!await deps.limit("identityStart", userId) || !await deps.limit("identityGlobal", "global")) {
          return { ok: false, code: "TOO_MANY_REQUESTS" };
        }
        let request = await deps.repository.begin(userId, p.id, IDENTITY_BIOMETRIC_CONSENT_VERSION, now());
        if (!request) return { ok: false, code: "PROFILE_REQUIRED" };
        if (request.provider !== p.id) return { ok: false, code: "PROVIDER_UNAVAILABLE" };

        // A pending request can already own a hosted session. Delete that
        // session before creating another one so repeated starts never orphan
        // provider data. Expired requests are handled by the same path.
        if (request.status === "pending" && request.providerReference) {
          if (!await p.purge({ requestId: request.requestId, providerReference: request.providerReference })) {
            return { ok: false, code: "PURGE_PENDING" };
          }
          if (!await deps.repository.removePending(request)) {
            return { ok: false, code: "PURGE_PENDING" };
          }
          request = await deps.repository.begin(userId, p.id, IDENTITY_BIOMETRIC_CONSENT_VERSION, now());
          if (!request) return { ok: false, code: "PROFILE_REQUIRED" };
        } else if (request.status === "pending" && request.expiresAt <= now()) {
          if (!await deps.repository.removePending(request)) return { ok: false, code: "PURGE_PENDING" };
          request = await deps.repository.begin(userId, p.id, IDENTITY_BIOMETRIC_CONSENT_VERSION, now());
          if (!request) return { ok: false, code: "PROFILE_REQUIRED" };
        }

        const launch = identityLaunchSchema.safeParse(await p.start({ requestId: request.requestId }));
        if (!launch.success) {
          return { ok: false, code: "PROVIDER_UNAVAILABLE" };
        }
        let bound = false;
        try {
          bound = await deps.repository.bindProviderReference(request, launch.data.providerReference);
        } catch {
          bound = false;
        }
        if (!bound) {
          try { await p.purge({ requestId: request.requestId, providerReference: launch.data.providerReference }); } catch { /* best effort */ }
          return { ok: false, code: "PROVIDER_UNAVAILABLE" };
        }
        return { ok: true, requestId: request.requestId, launch: launch.data };
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
        if (!request || request.provider !== p.id || request.requestedAt > time) {
          return { ok: false, code: "VERIFICATION_FAILED" };
        }

        if (request.status === "verified") return { ok: true, requestId };
        if (!request.providerReference) return { ok: false, code: "VERIFICATION_FAILED" };
        const providerReference = request.providerReference;

        if (request.status === "pending") {
          if (request.expiresAt <= time) return { ok: false, code: "VERIFICATION_FAILED" };
          const proof = await p.verify({ requestId: request.requestId, providerReference });
          const completedAt = now();
          if (!proof || !hasCompleteProof(proof, { requestId: request.requestId, providerReference }, completedAt) || proof.verifiedAt < request.requestedAt ||
            request.expiresAt <= completedAt || completedAt.getTime() - proof.verifiedAt.getTime() >= IDENTITY_REQUEST_TTL_MS ||
            request.biometricConsentVersion !== IDENTITY_BIOMETRIC_CONSENT_VERSION ||
            !await deps.repository.markVerifiedUnpurged(request, proof, completedAt)) {
            return { ok: false, code: "VERIFICATION_FAILED" };
          }
        }

        const purgeAccepted = await p.purge({ requestId: request.requestId, providerReference });
        if (!purgeAccepted) return { ok: false, code: "PURGE_PENDING" };
        const purgedAt = now();
        if (!await deps.repository.markVerified(request, purgedAt)) return { ok: false, code: "PURGE_PENDING" };
        return { ok: true, requestId };
      } catch {
        return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      }
    },
  };
}
