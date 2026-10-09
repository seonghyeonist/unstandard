import { getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { supportRepository } from "@/lib/db/repositories/support.repository";
import { isSameOriginMutation, readSmallJson } from "@/lib/http/profile-request";
import { privateJson } from "@/lib/http/private-json";
import { consumeRateLimit, RateLimitUnavailableError } from "@/lib/security/rate-limit";

const SUPPORT_CATEGORIES = new Set(["technical", "safety", "privacy", "account", "other"]);

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Unauthorized" }, { status: 403 });
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return privateJson({ error: "Support service unavailable" }, { status: 503 });
    }
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user) return privateJson({ error: "Unauthorized" }, { status: 401 });

  try {
    const decision = await consumeRateLimit({ scope: "supportCreate", subject: user.id });
    if (!decision.allowed) {
      return privateJson(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
      );
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return privateJson({ error: "Support service unavailable" }, { status: 503 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await readSmallJson(request, 12288);
  } catch {
    return privateJson({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return privateJson({ error: "Invalid body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const category = String(input.category ?? "").trim();
  const message = String(input.message ?? "").trim();
  if (!SUPPORT_CATEGORIES.has(category) || message.length < 10 || message.length > 2_000) {
    return privateJson({ error: "Invalid support request" }, { status: 400 });
  }

  try {
    const ticketId = await supportRepository.create(user.id, category, message);
    return privateJson({ ok: true, ticketId }, { status: 201 });
  } catch {
    return privateJson({ error: "Support service unavailable" }, { status: 503 });
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return privateJson({ error: "Unauthorized" }, { status: 401 });
    return privateJson({ tickets: await supportRepository.listForMember(user.id) });
  } catch {
    return privateJson({ error: "Support unavailable" }, { status: 503 });
  }
}
