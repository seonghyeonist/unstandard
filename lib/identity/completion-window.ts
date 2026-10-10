import { identityRequestIdSchema, type IdentityRequest } from "./contracts";

// A timely, authenticated Approved webhook may wait for provider/worker retries.
// This extends processing only; unsigned or late completions keep the original TTL.
export const IDENTITY_RECONCILIATION_GRACE_MS = 60 * 60 * 1000;

export function identityCompletionDeadline(request: Pick<IdentityRequest,
  "requestedAt" | "expiresAt" | "completionRequestedAt" | "completionEventId"
>): Date {
  const signal = request.completionRequestedAt;
  const timelySignal = signal !== null && Number.isFinite(signal.getTime()) &&
    signal >= request.requestedAt && signal < request.expiresAt &&
    identityRequestIdSchema.safeParse(request.completionEventId).success;
  return new Date(request.expiresAt.getTime() + (timelySignal ? IDENTITY_RECONCILIATION_GRACE_MS : 0));
}
