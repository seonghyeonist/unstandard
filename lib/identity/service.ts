import {
  IDENTITY_BIOMETRIC_CONSENT_VERSION,
  IDENTITY_REQUEST_TTL_MS,
  identityLaunchSchema,
  type IdentityProvider,
  type IdentityRepository,
  type IdentityLimiter,
  type IdentityProof,
  type IdentityResult,
  type IdentityEventLogger,
  type IdentityRequest,
} from "@/lib/identity/contracts";

export function identityService(deps: {
  provider: IdentityProvider | null;
  repository: IdentityRepository;
  limit: IdentityLimiter;
  now?: () => Date;
  log?: IdentityEventLogger;
}) {
  const now = deps.now ?? (() => new Date());
  function report(stage: "start" | "complete", status: "ok" | "error", code: string, providerStatus?: number): void {
    try {
      deps.log?.({
        event: `identity.${stage}.${code.toLowerCase()}`,
        stage,
        status,
        code,
        providerStatus,
      });
    } catch {
      // Diagnostics must never change the identity result.
    }
  }
  function hasCompleteProof(proof: IdentityProof, request: { requestId: string; providerReference: string }, completedAt: Date): boolean {
    return proof.requestId === request.requestId && proof.providerReference === request.providerReference &&
      proof.documentVerified === true && proof.livenessVerified === true && proof.faceMatchVerified === true &&
      proof.deviceIpVerified === true && proof.adultVerified === true &&
      Number.isFinite(proof.verifiedAt.getTime()) && proof.verifiedAt >= new Date(0) && proof.verifiedAt <= completedAt;
  }

  async function purgeRejectedOrExpiredRequest(
    request: IdentityRequest & { providerReference: string },
    provider: IdentityProvider,
  ): Promise<IdentityResult> {
    let purged: boolean;
    try {
      purged = await provider.purge({ requestId: request.requestId, providerReference: request.providerReference });
    } catch {
      purged = false;
    }
    if (!purged) {
      report("complete", "error", "PURGE_PENDING");
      return { ok: false, code: "PURGE_PENDING" };
    }
    if (!await deps.repository.removePending(request)) {
      report("complete", "error", "PURGE_STATE_WRITE_FAILED");
      return { ok: false, code: "PURGE_PENDING" };
    }
    report("complete", "error", "VERIFICATION_FAILED");
    return { ok: false, code: "VERIFICATION_FAILED" };
  }

  return {
    async start(userId: string): Promise<IdentityResult> {
      const p = deps.provider;
      if (!p) {
        report("start", "error", "PROVIDER_UNAVAILABLE");
        return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      }
      try {
        if (!await deps.limit("identityStart", userId) || !await deps.limit("identityGlobal", "global")) {
          report("start", "error", "TOO_MANY_REQUESTS");
          return { ok: false, code: "TOO_MANY_REQUESTS" };
        }
        let request = await deps.repository.begin(userId, p.id, IDENTITY_BIOMETRIC_CONSENT_VERSION, now());
        if (!request) {
          report("start", "error", "PROFILE_REQUIRED");
          return { ok: false, code: "PROFILE_REQUIRED" };
        }
        if (request.provider !== p.id) {
          report("start", "error", "PROVIDER_UNAVAILABLE");
          return { ok: false, code: "PROVIDER_UNAVAILABLE" };
        }

        // A pending request can already own a hosted session. Delete that
        // session before creating another one so repeated starts never orphan
        // provider data. Expired requests are handled by the same path.
        if (request.status === "pending" && request.providerReference) {
          if (!await p.purge({ requestId: request.requestId, providerReference: request.providerReference })) {
            report("start", "error", "PURGE_PENDING");
            return { ok: false, code: "PURGE_PENDING" };
          }
          if (!await deps.repository.removePending(request)) {
            report("start", "error", "PURGE_PENDING");
            return { ok: false, code: "PURGE_PENDING" };
          }
          request = await deps.repository.begin(userId, p.id, IDENTITY_BIOMETRIC_CONSENT_VERSION, now());
          if (!request) {
            report("start", "error", "PROFILE_REQUIRED");
            return { ok: false, code: "PROFILE_REQUIRED" };
          }
        } else if (request.status === "pending" && request.expiresAt <= now()) {
          if (!await deps.repository.removePending(request)) {
            report("start", "error", "PURGE_PENDING");
            return { ok: false, code: "PURGE_PENDING" };
          }
          request = await deps.repository.begin(userId, p.id, IDENTITY_BIOMETRIC_CONSENT_VERSION, now());
          if (!request) {
            report("start", "error", "PROFILE_REQUIRED");
            return { ok: false, code: "PROFILE_REQUIRED" };
          }
        }

        let launch;
        try {
          launch = identityLaunchSchema.safeParse(await p.start({ requestId: request.requestId }));
        } catch {
          report("start", "error", "SESSION_CREATE_FAILED");
          return { ok: false, code: "PROVIDER_UNAVAILABLE" };
        }
        if (!launch.success) {
          report("start", "error", "LAUNCH_INVALID");
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
          report("start", "error", "PROVIDER_REFERENCE_BIND_FAILED");
          return { ok: false, code: "PROVIDER_UNAVAILABLE" };
        }
        report("start", "ok", "SESSION_CREATED");
        return { ok: true, requestId: request.requestId, launch: launch.data };
      } catch {
        report("start", "error", "PROVIDER_UNAVAILABLE");
        return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      }
    },
    async complete(userId: string, requestId: string): Promise<IdentityResult> {
      const p = deps.provider;
      if (!p) {
        report("complete", "error", "PROVIDER_UNAVAILABLE");
        return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      }
      try {
        if (!await deps.limit("identityComplete", userId)) {
          report("complete", "error", "TOO_MANY_REQUESTS");
          return { ok: false, code: "TOO_MANY_REQUESTS" };
        }
        const request = await deps.repository.find(userId, requestId);
        const time = now();
        if (!request || request.provider !== p.id || request.requestedAt > time) {
          report("complete", "error", "REQUEST_INVALID");
          return { ok: false, code: "VERIFICATION_FAILED" };
        }

        if (request.status === "verified") {
          report("complete", "ok", "ALREADY_VERIFIED");
          return { ok: true, requestId };
        }
        if (!request.providerReference) {
          report("complete", "error", "DECISION_INVALID");
          return { ok: false, code: "VERIFICATION_FAILED" };
        }
        const providerReference = request.providerReference;
        const boundRequest = { ...request, providerReference };

        if (request.status === "pending") {
          if (request.expiresAt <= time) {
            return purgeRejectedOrExpiredRequest(boundRequest, p);
          }
          let proof: IdentityProof | null;
          try {
            proof = await p.verify({ requestId: request.requestId, providerReference });
          } catch {
            report("complete", "error", "CANONICAL_DECISION_REQUEST_FAILED");
            return { ok: false, code: "PROVIDER_UNAVAILABLE" };
          }
          const completedAt = now();
          if (!proof || !hasCompleteProof(proof, { requestId: request.requestId, providerReference }, completedAt) || proof.verifiedAt < request.requestedAt ||
            request.expiresAt <= completedAt || completedAt.getTime() - proof.verifiedAt.getTime() >= IDENTITY_REQUEST_TTL_MS ||
            request.biometricConsentVersion !== IDENTITY_BIOMETRIC_CONSENT_VERSION) {
            return purgeRejectedOrExpiredRequest(boundRequest, p);
          }
          if (!await deps.repository.markVerifiedUnpurged(request, proof, completedAt)) {
            return purgeRejectedOrExpiredRequest(boundRequest, p);
          }
        }

        let purgeAccepted: boolean;
        try {
          purgeAccepted = await p.purge({ requestId: request.requestId, providerReference });
        } catch {
          report("complete", "error", "SESSION_PURGE_REQUEST_FAILED");
          return { ok: false, code: "PROVIDER_UNAVAILABLE" };
        }
        if (!purgeAccepted) {
          report("complete", "error", "PURGE_PENDING");
          return { ok: false, code: "PURGE_PENDING" };
        }
        const purgedAt = now();
        if (!await deps.repository.markVerified(request, purgedAt)) {
          report("complete", "error", "PURGE_STATE_WRITE_FAILED");
          return { ok: false, code: "PURGE_PENDING" };
        }
        report("complete", "ok", "VERIFIED");
        return { ok: true, requestId };
      } catch {
        report("complete", "error", "PROVIDER_UNAVAILABLE");
        return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      }
    },
  };
}
