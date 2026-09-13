import { setOperatorSession, verifyOperatorToken } from "@/lib/alpha/operator-auth";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation, readSmallJson } from "@/lib/http/profile-request";
import {
  consumeRateLimit,
  RateLimitUnavailableError,
  requestIpAddress,
} from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Unauthorized" }, { status: 403 });

  try {
    const decision = await consumeRateLimit({
      scope: "operatorLogin",
      subject: requestIpAddress(request),
    });
    if (!decision.allowed) {
      return privateJson({ error: "Too many requests" }, {
        status: 429,
        headers: { "Retry-After": String(decision.retryAfterSeconds) },
      });
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return privateJson({ error: "Operator access unavailable" }, { status: 503 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await readSmallJson(request, 1024);
  } catch {
    return privateJson({ error: "Unauthorized" }, { status: 403 });
  }
  const token = body && typeof body === "object"
    ? String((body as Record<string, unknown>).token ?? "")
    : "";
  if (!verifyOperatorToken(token) || !(await setOperatorSession())) {
    return privateJson({ error: "Unauthorized" }, { status: 403 });
  }
  return privateJson({ ok: true });
}
