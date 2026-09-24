import {
  identityProviderReferenceSchema,
  identityRequestIdSchema,
  type IdentityProvider,
  type IdentityRepository,
  type IdentityResult,
} from "@/lib/identity/contracts";

type IdentityCompletionService = {
  complete(userId: string, requestId: string): Promise<IdentityResult>;
};

export type IdentityReconciliationResult = {
  selected: number;
  verified: number;
  retryable: number;
  cleared: number;
};

/**
 * Complete webhook-scheduled identity requests outside Didit's five-second
 * delivery window. Rows are durable before a webhook receives 202; expired
 * pending sessions and verified-unpurged rows are also revisited so an
 * abandoned browser flow cannot strand provider data. The loop is intentionally
 * bounded and sequential for the small closed-alpha cohort.
 */
export async function reconcileIdentityCompletions(input: {
  repository: Pick<IdentityRepository, "listCompletionRequests" | "clearCompletionRequested">;
  service: IdentityCompletionService;
  limit?: number;
}): Promise<IdentityReconciliationResult> {
  const requests = await input.repository.listCompletionRequests(input.limit ?? 25);
  const result: IdentityReconciliationResult = { selected: requests.length, verified: 0, retryable: 0, cleared: 0 };

  for (const request of requests) {
    const completion = await input.service.complete(request.userId, request.requestId);
    if (completion.ok) {
      result.verified++;
      continue;
    }
    if (completion.code === "VERIFICATION_FAILED" || completion.code === "PROFILE_REQUIRED") {
      if (await input.repository.clearCompletionRequested(request)) result.cleared++;
      continue;
    }
    result.retryable++;
  }

  return result;
}


export type IdentityProviderPurgeEntry = {
  requestId: string;
  provider: string;
  providerReference: string;
};

type IdentityProviderPurgeRepository = {
  listProviderPurges(limit: number): Promise<IdentityProviderPurgeEntry[]>;
  deleteProviderPurge(entry: IdentityProviderPurgeEntry): Promise<boolean>;
  markProviderPurgeRetry(entry: IdentityProviderPurgeEntry): Promise<void>;
};

export type IdentityProviderPurgeResult = {
  selected: number;
  purged: number;
  retryable: number;
};

/**
 * Drain a small sequential batch of deletion records. The queue has no user
 * identifier and the provider client exposes deletion only. Keep each row
 * unless the provider confirms session/template erasure (or confirms it is
 * already absent).
 */
export async function reconcileIdentityProviderPurges(input: {
  repository: IdentityProviderPurgeRepository;
  provider: Pick<IdentityProvider, "id" | "purge">;
  limit?: number;
}): Promise<IdentityProviderPurgeResult> {
  const requests = await input.repository.listProviderPurges(input.limit ?? 25);
  const result: IdentityProviderPurgeResult = { selected: requests.length, purged: 0, retryable: 0 };

  for (const request of requests) {
    if (
      request.provider !== input.provider.id ||
      !identityRequestIdSchema.safeParse(request.requestId).success ||
      !identityProviderReferenceSchema.safeParse(request.providerReference).success
    ) {
      result.retryable++;
      continue;
    }

    let purged = false;
    try {
      purged = await input.provider.purge({
        requestId: request.requestId,
        providerReference: request.providerReference,
        deletionInstruction: "privacy_erasure",
      });
    } catch {
      purged = false;
    }
    if (!purged) {
      await input.repository.markProviderPurgeRetry(request);
      result.retryable++;
      continue;
    }

    // If database deletion fails the outbox row remains for an idempotent
    // retry. A concurrent worker may already have removed it after a
    // successful provider acknowledgement.
    await input.repository.deleteProviderPurge(request);
    result.purged++;
  }

  return result;
}
