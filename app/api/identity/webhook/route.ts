import "server-only";

import { after } from "next/server";
import { z } from "zod";
import { privateJson } from "@/lib/http/private-json";
import { readSmallJson } from "@/lib/http/profile-request";
import { parseDiditIdentityConfig } from "@/lib/identity/didit";
import { verifyDiditWebhookSignature, verifyDiditWebhookSimpleSignature } from "@/lib/identity/didit-webhook";
import { IDENTITY_PROVIDER_NOTICE_READY } from "@/lib/identity/notice";
import { identityRepository } from "@/lib/db/repositories/identity.repository";
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
  const config = parseDiditIdentityConfig(process.env);
  if (!IDENTITY_PROVIDER_NOTICE_READY || !config?.webhookSecret) {
    return privateJson({ error: "Webhook unavailable" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await readSmallJson(request, 256 * 1024);
  } catch {
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
    return privateJson({ error: "Invalid webhook" }, { status: 401 });
  }

  if (envelope.success && envelope.data.workflow_id && envelope.data.workflow_id !== config.workflowId) {
    return privateJson({ error: "Invalid webhook" }, { status: 401 });
  }

  // The webhook is only a queue signal. The callback re-fetches the canonical
  // decision and the repository's verified state makes retries idempotent.
  try {
    after(async () => {
      try {
        const requestRow = await identityRepository.findByProviderReference(envelope.data.session_id);
        if (!requestRow || requestRow.requestId !== envelope.data.vendor_data || requestRow.status === "verified") return;
        await createIdentityService().complete(requestRow.userId, requestRow.requestId);
      } catch {
        // Didit retries 5xx/404; no provider or decision payload is logged here.
      }
    });
  } catch {
    return privateJson({ error: "Webhook unavailable" }, { status: 503 });
  }
  return privateJson({ accepted: true }, { status: 202 });
}
