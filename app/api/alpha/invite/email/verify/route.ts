import { cookies } from "next/headers";
import { isDatabaseAuthConfigured } from "@/lib/config/runtime-mode";
import { verifyEmailVerificationCode } from "@/lib/auth/email-verification";
import { isPreparedInviteUsable } from "@/lib/auth/invite-gate";
import {
  createEmailVerificationTicket,
  getEmailVerificationCookieName,
  getPreparedInviteCookieName,
  verifyPreparedInviteTicket,
} from "@/lib/auth/invite-ticket";
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
    body = await readSmallJson(request, 512);
  } catch {
    return privateJson({ error: "Invalid code" }, { status: 400 });
  }
  const code = body && typeof body === "object" ? String((body as Record<string, unknown>).code ?? "") : "";
  if (!/^\d{6}$/.test(code)) return privateJson({ error: "Invalid code" }, { status: 422 });

  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) return privateJson({ error: "Registration unavailable" }, { status: 503 });

  const cookieStore = await cookies();
  const prepared = verifyPreparedInviteTicket(
    cookieStore.get(getPreparedInviteCookieName())?.value ?? "",
    secret,
  );
  if (!prepared || !(await isPreparedInviteUsable(prepared))) {
    return privateJson({ error: "Invalid invite link" }, { status: 403 });
  }

  try {
    for (const subject of [requestIpAddress(request), `invite:${prepared.inviteId}`]) {
      const decision = await consumeRateLimit({ scope: "inviteEmailVerify", subject });
      if (!decision.allowed) {
        return privateJson(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
        );
      }
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return privateJson({ error: "Registration unavailable" }, { status: 503 });
    }
    throw error;
  }

  const result = await verifyEmailVerificationCode({
    challengeId: String(body && typeof body === "object" ? (body as Record<string, unknown>).challengeId ?? "" : ""),
    inviteId: prepared.inviteId,
    email: prepared.email,
    code,
  });
  if (!result.ok) {
    const status = result.code === "EXPIRED" ? 410 : result.code === "ATTEMPTS_EXCEEDED" ? 429 : 422;
    return privateJson({ error: "The verification code is invalid or expired" }, { status });
  }

  const ticket = createEmailVerificationTicket(
    result.inviteId,
    result.email,
    result.challengeId,
    secret,
  );
  cookieStore.set(getEmailVerificationCookieName(), ticket.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ticket.maxAge,
  });
  cookieStore.delete(getPreparedInviteCookieName());

  return privateJson({ ok: true });
}
