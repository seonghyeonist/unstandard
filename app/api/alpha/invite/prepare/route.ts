import { cookies } from "next/headers";
import { prepareInviteForRegistration } from "@/lib/auth/invite-gate";
import {
  createPreparedInviteTicket,
  getPreparedInviteCookieName,
} from "@/lib/auth/invite-ticket";
import { isDatabaseAuthConfigured } from "@/lib/config/runtime-mode";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation, readSmallJson } from "@/lib/http/profile-request";
import {
  consumeRateLimit,
  RateLimitUnavailableError,
  requestIpAddress,
} from "@/lib/security/rate-limit";

/**
 * Exchange #invite=<capability> only after the client removes the fragment.
 * This route deliberately validates without reserving or consuming the invite.
 */
export async function POST(request: Request) {
  if (!isDatabaseAuthConfigured()) {
    return privateJson({ error: "Registration unavailable" }, { status: 503 });
  }
  if (!isSameOriginMutation(request)) {
    return privateJson({ error: "Registration unavailable" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await readSmallJson(request, 1024);
  } catch {
    return privateJson({ error: "Invalid invite link" }, { status: 400 });
  }
  const capability = body && typeof body === "object"
    ? String((body as Record<string, unknown>).capability ?? "")
    : "";

  try {
    const decision = await consumeRateLimit({
      scope: "invitePrepare",
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
      return privateJson({ error: "Registration unavailable" }, { status: 503 });
    }
    throw error;
  }

  const prepared = await prepareInviteForRegistration(capability);
  if (!prepared.ok) {
    return privateJson({ error: "Invalid invite link" }, { status: 403 });
  }

  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) return privateJson({ error: "Registration unavailable" }, { status: 503 });

  const ticket = createPreparedInviteTicket(prepared.inviteId, prepared.email, secret);
  const cookieStore = await cookies();
  cookieStore.set(getPreparedInviteCookieName(), ticket.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ticket.maxAge,
  });

  return privateJson({ ok: true });
}
