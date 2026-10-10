import RegisterForm from "@/components/auth/register-form";
import { cookies } from "next/headers";
import {
  getPreparedInviteCookieName,
  getEmailVerificationCookieName,
  getRegistrationTicketCookieName,
  verifyEmailVerificationTicket,
  verifyPreparedInviteTicket,
  verifyRegistrationTicket,
} from "@/lib/auth/invite-ticket";
import { getCanonicalAuthOrigin } from "@/lib/auth/canonical-origin";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  const cookieStore = await cookies();
  const prepared = secret
    ? verifyPreparedInviteTicket(cookieStore.get(getPreparedInviteCookieName())?.value ?? "", secret)
    : null;
  const reserved = secret
    ? verifyRegistrationTicket(cookieStore.get(getRegistrationTicketCookieName())?.value ?? "", secret)
    : null;
  const verified = secret
    ? verifyEmailVerificationTicket(cookieStore.get(getEmailVerificationCookieName())?.value ?? "", secret)
    : null;
  return <RegisterForm
    canonicalOrigin={getCanonicalAuthOrigin()}
    initialInviteReady={Boolean(prepared || verified || reserved)}
  />;
}
