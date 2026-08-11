import { cookies } from "next/headers";
import { isDatabaseAuthConfigured } from "@/lib/config/runtime-mode";
import { reserveInviteForEmail } from "@/lib/auth/invite-gate";
import { normalizeEmail } from "@/lib/auth/invite-crypto";
import {
  createRegistrationTicket,
  getRegistrationTicketCookieName,
} from "@/lib/auth/invite-ticket";
import { privateJson } from "@/lib/http/private-json";
import {
  consumeRateLimit,
  RateLimitUnavailableError,
  requestIpAddress,
} from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (!isDatabaseAuthConfigured()) {
    return privateJson({ error: "Registration unavailable" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return privateJson({ error: "Invalid body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const email = normalizeEmail(String(input.email ?? ""));
  const code = String(input.code ?? "").trim();

  if (!email.includes("@") || code.length < 8) {
    return privateJson({ error: "Invalid invite claim" }, { status: 422 });
  }

  try {
    const decision = await consumeRateLimit({
      scope: "inviteClaim",
      subject: requestIpAddress(request),
    });
    if (!decision.allowed) {
      return privateJson(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
      );
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return privateJson({ error: "Registration unavailable" }, { status: 503 });
    }
    throw error;
  }

  const claim = await reserveInviteForEmail(code, email);
  if (!claim.ok) {
    return privateJson({ error: "Invalid invite claim" }, { status: 403 });
  }

  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    return privateJson({ error: "Registration unavailable" }, { status: 503 });
  }

  const ticket = createRegistrationTicket(
    claim.inviteId,
    claim.email,
    claim.reservationCapability,
    secret,
  );
  const cookieStore = await cookies();
  cookieStore.set(getRegistrationTicketCookieName(), ticket.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ticket.maxAge,
  });

  return privateJson({ ok: true });
}
