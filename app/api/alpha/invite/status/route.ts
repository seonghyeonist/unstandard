import { cookies } from "next/headers";
import { isDatabaseAuthConfigured } from "@/lib/config/runtime-mode";
import { isEmailVerificationTicketUsable } from "@/lib/auth/email-verification";
import { isPreparedInviteUsable, verifyInviteReservation } from "@/lib/auth/invite-gate";
import {
  getEmailVerificationCookieName,
  getPreparedInviteCookieName,
  getRegistrationTicketCookieName,
  verifyEmailVerificationTicket,
  verifyPreparedInviteTicket,
  verifyRegistrationTicket,
} from "@/lib/auth/invite-ticket";
import { getCanonicalAuthOrigin } from "@/lib/auth/canonical-origin";
import { privateJson } from "@/lib/http/private-json";

export async function GET(request: Request) {
  if (!isDatabaseAuthConfigured()) {
    return privateJson({ state: "unavailable" }, { status: 503 });
  }
  if (new URL(request.url).origin !== getCanonicalAuthOrigin()) {
    return privateJson({ state: "missing" }, { status: 403 });
  }

  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) return privateJson({ state: "unavailable" }, { status: 503 });

  const cookieStore = await cookies();
  const registration = verifyRegistrationTicket(
    cookieStore.get(getRegistrationTicketCookieName())?.value ?? "",
    secret,
  );
  if (
    registration &&
    (await verifyInviteReservation(registration)) &&
    (await isEmailVerificationTicketUsable({
      inviteId: registration.inviteId,
      email: registration.email,
      challengeId: registration.emailVerificationId,
      exp: registration.exp,
    }))
  ) {
    return privateJson({ state: "password_ready", email: registration.email });
  }

  const proof = verifyEmailVerificationTicket(
    cookieStore.get(getEmailVerificationCookieName())?.value ?? "",
    secret,
  );
  if (proof && (await isEmailVerificationTicketUsable(proof))) {
    return privateJson({ state: "email_verified", email: proof.email });
  }

  const prepared = verifyPreparedInviteTicket(
    cookieStore.get(getPreparedInviteCookieName())?.value ?? "",
    secret,
  );
  if (prepared && (await isPreparedInviteUsable(prepared))) {
    return privateJson({ state: "invite_ready", email: prepared.email });
  }

  return privateJson({ state: "missing" });
}
