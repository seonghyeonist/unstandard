import "server-only";

import { z } from "zod";
import { privateJson } from "@/lib/http/private-json";
import { readSmallJson } from "@/lib/http/profile-request";
import { parseDiditIdentityConfig } from "@/lib/identity/didit";
import { verifyDiditWebhookSignature, verifyDiditWebhookSimpleSignature } from "@/lib/identity/didit-webhook";
import { identityRepository } from "@/lib/db/repositories/identity.repository";
import { getIdentityReadiness } from "@/lib/server/identity/provider";
import { logIdentityEvent } from "@/lib/server/identity/identity-logger";
import { createIdentityService } from "@/lib/server/identity/service";

const sessionWebhookSchema = z.object({
  event_id: z.string().uuid(),
  webhook_type: z.enum(["status.updated", "data.updated"]),
  timestamp: z.number().int().nonnegative(),
  session_id: z.string().uuid(),
  status: z.string().trim().min(1).max(64),
  session_kind: z.literal("user").optional(),
  workflow_id: z.string().uuid().optional(),
  vendor_data: z.string().uuid(),
}).passthrough();

export async function POST(request: Request) {
  const readiness = getIdentityReadiness();
  const config = parseDiditIdentityConfig(process.env);
  if (!readiness.available || !config?.webhookSecret) {
    logIdentityEvent({
      event: "identity.webhook.provider_unavailable",
      stage: "webhook",
      status: "error",
      code: readiness.available ? "WEBHOOK_NOT_CONFIGURED" : readiness.code,
    });
    return privateJson({ error: "Webhook unavailable" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await readSmallJson(request, 256 * 1024);
  } catch {
    logIdentityEvent({ event: "identity.webhook.invalid_body", stage: "webhook", status: "error", code: "INVALID_BODY" });
    return privateJson({ error: "Invalid webhook" }, { status: 400 });
  }

  const envelope = sessionWebhookSchema.safeParse(body);
  const timestamp = request.headers.get("x-timestamp");
  const v2Verified = envelope.success && timestamp === String(envelope.data.timestamp) &&
    verifyDiditWebhookSignature({
      payload: body,
      signature: request.headers.get("x-signature-v2"),
      timestamp,
      secret: config.webhookSecret,
    });
  const simpleVerified = envelope.success && timestamp === String(envelope.data.timestamp) &&
    verifyDiditWebhookSimpleSignature({
      timestamp,
      sessionId: envelope.data.session_id,
      status: envelope.data.status,
      webhookType: envelope.data.webhook_type,
      signature: request.headers.get("x-signature-simple"),
      secret: config.webhookSecret,
    });
  if (!v2Verified && !simpleVerified) {
    logIdentityEvent({ event: "identity.webhook.signature_invalid", stage: "webhook", status: "error", code: "SIGNATURE_INVALID" });
    return privateJson({ error: "Invalid webhook" }, { status: 401 });
  }

  if (envelope.success && envelope.data.workflow_id && envelope.data.workflow_id !== config.workflowId) {
    logIdentityEvent({ event: "identity.webhook.workflow_mismatch", stage: "webhook", status: "error", code: "WORKFLOW_MISMATCH" });
    return privateJson({ error: "Invalid webhook" }, { status: 401 });
  }

  // A valid webhook is only a signal to perform the canonical provider lookup.
  // Completion happens before acknowledgement: transient provider/purge/rate
  // limit failures return 503 so Didit can retry. This avoids acknowledging a
  // delivery while an after() callback is still an untracked best-effort task.
  let requestRow;
  try {
    requestRow = await identityRepository.findByProviderReference(envelope.data.session_id);
  } catch {
    logIdentityEvent({ event: "identity.webhook.lookup_failed", stage: "webhook", status: "error", code: "REQUEST_LOOKUP_RETRYABLE" });
    return privateJson({ error: "Webhook unavailable" }, { status: 503 });
  }

  if (!requestRow || requestRow.requestId !== envelope.data.vendor_data || requestRow.status === "verified") {
    logIdentityEvent({ event: "identity.webhook.ignored", stage: "webhook", status: "ok", code: "NO_PENDING_REQUEST" });
    return privateJson({ accepted: true }, { status: 200 });
  }

  let result;
  try {
    result = await createIdentityService().complete(requestRow.userId, requestRow.requestId);
  } catch {
    logIdentityEvent({ event: "identity.webhook.complete_failed", stage: "webhook", status: "error", code: "COMPLETE_RETRYABLE" });
    return privateJson({ error: "Webhook unavailable" }, { status: 503 });
  }

  if (!result.ok) {
    const retryable = result.code === "PROVIDER_UNAVAILABLE" ||
      result.code === "PURGE_PENDING" ||
      result.code === "TOO_MANY_REQUESTS";
    logIdentityEvent({
      event: "identity.webhook.complete_failed",
      stage: "webhook",
      status: retryable ? "error" : "ok",
      code: retryable ? "COMPLETE_RETRYABLE" : "COMPLETE_NOT_APPROVED",
    });
    if (retryable) return privateJson({ error: "Webhook unavailable" }, { status: 503 });
    return privateJson({ accepted: true }, { status: 202 });
  }

  logIdentityEvent({ event: "identity.webhook.accepted", stage: "webhook", status: "ok", code: "WEBHOOK_COMPLETED" });
  return privateJson({ accepted: true }, { status: 200 });
}
