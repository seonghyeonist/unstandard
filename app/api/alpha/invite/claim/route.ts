import { cookies } from "next/headers";
import { isDatabaseAuthConfigured } from "@/lib/config/runtime-mode";
import { reservePreparedInvite, verifyInviteReservation } from "@/lib/auth/invite-gate";
import {
  createRegistrationTicket,
  getPreparedInviteCookieName,
  getRegistrationTicketCookieName,
  verifyPreparedInviteTicket,
  verifyRegistrationTicket,
} from "@/lib/auth/invite-ticket";
import { parseRegistrationLegalSelection } from "@/lib/legal/acceptance";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation, readSmallJson } from "@/lib/http/profile-request";
import {
  consumeRateLimit,
  RateLimitUnavailableError,
  requestIpAddress,
} from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (!isDatabaseAuthConfigured()) {
    return privateJson({ error: "Registration unavailable" }, { status: 503 });
  }
  if (!isSameOriginMutation(request)) {
    return privateJson({ error: "Registration unavailable" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await readSmallJson(request);
  } catch {
    return privateJson({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return privateJson({ error: "Invalid body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const legalSelection = parseRegistrationLegalSelection(input);

  if (!legalSelection) {
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

  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    return privateJson({ error: "Registration unavailable" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const existingRaw = cookieStore.get(getRegistrationTicketCookieName())?.value;
  const existing = existingRaw ? verifyRegistrationTicket(existingRaw, secret) : null;
  // OAuth cancellation/retry in the same browser must not consume a second
  // reservation. The signed ticket was created only after legal acceptance.
  if (existing && await verifyInviteReservation(existing)) {
    return privateJson({ ok: true });
  }
  if (existingRaw) cookieStore.delete(getRegistrationTicketCookieName());

  const preparedRaw = cookieStore.get(getPreparedInviteCookieName())?.value;
  const prepared = preparedRaw ? verifyPreparedInviteTicket(preparedRaw, secret) : null;
  if (!prepared) {
    return privateJson({ error: "Invalid invite claim" }, { status: 403 });
  }

  const claim = await reservePreparedInvite(prepared.inviteId, prepared.email);
  if (!claim.ok) {
    cookieStore.delete(getPreparedInviteCookieName());
    return privateJson({ error: "Invalid invite claim" }, { status: 403 });
  }

  const ticket = createRegistrationTicket(
    claim.inviteId,
    claim.email,
    claim.reservationCapability,
    secret,
    legalSelection,
  );
  cookieStore.set(getRegistrationTicketCookieName(), ticket.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ticket.maxAge,
  });
  cookieStore.delete(getPreparedInviteCookieName());

  return privateJson({ ok: true });
}
