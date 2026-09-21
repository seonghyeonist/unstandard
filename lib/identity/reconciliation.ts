import type { IdentityRepository, IdentityResult } from "@/lib/identity/contracts";

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
