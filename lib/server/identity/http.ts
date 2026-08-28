import "server-only";
import { z } from "zod";
import { AuthError, requireAuthenticatedUser } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation, readSmallJson } from "@/lib/http/profile-request";
import { IDENTITY_NOTICE_VERSION } from "@/lib/identity/contracts";
import { getIdentityProvider } from "@/lib/server/identity/provider";
import { createIdentityService } from "@/lib/server/identity/service";

const startSchema = z.object({ consentAccepted: z.literal(true), noticeVersion: z.literal(IDENTITY_NOTICE_VERSION) }).strict();
const completeSchema = z.object({ requestId: z.string().uuid() }).strict();
export async function handleIdentity(request: Request, action: "start" | "complete") {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Forbidden" }, { status: 403 });
  try {
    if (!isDatabaseRuntime()) return privateJson({ code: "PROVIDER_UNAVAILABLE" }, { status: 503 });
    const user = await requireAuthenticatedUser();
    // Before body parsing: never accept real-name/phone payload while the provider is unconfigured.
    if (!getIdentityProvider()) return privateJson({ code: "PROVIDER_UNAVAILABLE" }, { status: 503 });
    let body;
    try { body = await readSmallJson(request, 512); }
    catch { return privateJson({ error: "Invalid body" }, { status: 400 }); }
    const service = createIdentityService();
    let result;
    if (action === "start") {
      if (!startSchema.safeParse(body).success) return privateJson({ error: "Invalid consent" }, { status: 400 });
      result = await service.start(user.id);
    } else {
      const input = completeSchema.safeParse(body);
      if (!input.success) return privateJson({ error: "Invalid request" }, { status: 400 });
      result = await service.complete(user.id, input.data.requestId);
    }
    const status = result.ok ? 200 : result.code === "TOO_MANY_REQUESTS" ? 429 : result.code === "PROVIDER_UNAVAILABLE" ? 503 : 409;
    return privateJson(result, { status });
  } catch (e) { return privateJson({ error: "Verification unavailable" }, { status: e instanceof AuthError ? 401 : 503 }); }
}
