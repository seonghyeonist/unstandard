import { cookies } from "next/headers";
import { isDatabaseAuthConfigured } from "@/lib/config/runtime-mode";
import {
  createEmailVerificationChallenge,
  invalidateEmailVerificationChallenge,
} from "@/lib/auth/email-verification";
import {
  getPreparedInviteCookieName,
  verifyPreparedInviteTicket,
} from "@/lib/auth/invite-ticket";
import { isPreparedInviteUsable } from "@/lib/auth/invite-gate";
import { sendInviteVerificationEmail } from "@/lib/email/transactional";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation } from "@/lib/http/profile-request";
import {
  consumeRateLimit,
  RateLimitUnavailableError,
  requestIpAddress,
} from "@/lib/security/rate-limit";

async function rateLimitEmailRequest(request: Request, inviteId: string, email: string) {
  const subjects = [
    requestIpAddress(request),
    `invite:${inviteId}`,
    `email:${email}`,
  ];
  for (const subject of subjects) {
    const decision = await consumeRateLimit({ scope: "inviteEmailSend", subject });
    if (!decision.allowed) return decision;
  }
  return { allowed: true as const, remaining: 0 };
}

export async function POST(request: Request) {
  if (!isDatabaseAuthConfigured()) {
    return privateJson({ error: "Registration unavailable" }, { status: 503 });
  }
  if (!isSameOriginMutation(request)) {
    return privateJson({ error: "Registration unavailable" }, { status: 403 });
  }

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
    const decision = await rateLimitEmailRequest(request, prepared.inviteId, prepared.email);
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

  let challenge: Awaited<ReturnType<typeof createEmailVerificationChallenge>>;
  try {
    challenge = await createEmailVerificationChallenge(prepared);
  } catch {
    return privateJson({ error: "Registration unavailable" }, { status: 503 });
  }
  if (!challenge.ok) {
    if (challenge.code === "COOLDOWN") {
      return privateJson(
        { error: "Please wait before requesting another code" },
        { status: 429, headers: { "Retry-After": String(challenge.retryAfterSeconds ?? 60) } },
      );
    }
    return privateJson({ error: "Invalid invite link" }, { status: 403 });
  }

  try {
    await sendInviteVerificationEmail({
      to: challenge.email,
      code: challenge.code,
      expiresInMinutes: 10,
    });
  } catch {
    await invalidateEmailVerificationChallenge(challenge.challengeId);
    console.error({ action: "invite_email_delivery_failed", code: "EMAIL_DELIVERY_FAILED" });
    return privateJson({ error: "Email delivery is temporarily unavailable" }, { status: 503 });
  }

  // The challenge id is not an authentication secret; it only selects the
  // server row and remains bound to the invite/email on verification.
  return privateJson({ ok: true, challengeId: challenge.challengeId });
}
