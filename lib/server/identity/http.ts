import "server-only";
import { z } from "zod";
import { AuthError, requireAuthenticatedUser } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation, readSmallJson } from "@/lib/http/profile-request";
import { IDENTITY_NOTICE_VERSION } from "@/lib/identity/contracts";
import { getIdentityReadiness } from "@/lib/server/identity/provider";
import { logIdentityEvent } from "@/lib/server/identity/identity-logger";
import { createIdentityService } from "@/lib/server/identity/service";

const startSchema = z.object({ consentAccepted: z.literal(true), noticeVersion: z.literal(IDENTITY_NOTICE_VERSION) }).strict();
const completeSchema = z.object({ requestId: z.string().uuid() }).strict();
export async function handleIdentity(request: Request, action: "start" | "complete") {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Forbidden" }, { status: 403 });
  try {
    if (!isDatabaseRuntime()) return privateJson({ code: "PROVIDER_UNAVAILABLE" }, { status: 503 });
    const user = await requireAuthenticatedUser();
    // Before body parsing: never accept real-name/phone payload while the provider is unconfigured.
    const readiness = getIdentityReadiness();
    if (!readiness.available) {
      logIdentityEvent({ event: `identity.${action}.provider_unavailable`, stage: action, status: "error", code: readiness.code });
      return privateJson({ code: "PROVIDER_UNAVAILABLE" }, { status: 503 });
    }
    let body;
    try { body = await readSmallJson(request, 512); }
    catch {
      logIdentityEvent({ event: `identity.${action}.invalid_body`, stage: action, status: "error", code: "INVALID_BODY" });
      return privateJson({ error: "Invalid body" }, { status: 400 });
    }
    const service = createIdentityService();
    let result;
    if (action === "start") {
      if (!startSchema.safeParse(body).success) {
        logIdentityEvent({ event: "identity.start.invalid_consent", stage: "start", status: "error", code: "INVALID_CONSENT" });
        return privateJson({ error: "Invalid consent" }, { status: 400 });
      }
      result = await service.start(user.id);
    } else {
      const input = completeSchema.safeParse(body);
      if (!input.success) {
        logIdentityEvent({ event: "identity.complete.invalid_request", stage: "complete", status: "error", code: "INVALID_REQUEST" });
        return privateJson({ error: "Invalid request" }, { status: 400 });
      }
      result = await service.complete(user.id, input.data.requestId);
    }
    const status = result.ok ? 200 : result.code === "TOO_MANY_REQUESTS" ? 429 : result.code === "PROVIDER_UNAVAILABLE" ? 503 : 409;
    return privateJson(result, { status });
  } catch (e) {
    logIdentityEvent({
      event: `identity.${action}.route_failed`,
      stage: action,
      status: "error",
      code: e instanceof AuthError ? "AUTH_REQUIRED" : "ROUTE_FAILED",
    });
    return privateJson({ error: "Verification unavailable" }, { status: e instanceof AuthError ? 401 : 503 });
  }
}
