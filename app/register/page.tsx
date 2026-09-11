import RegisterForm from "@/components/auth/register-form";
import { cookies } from "next/headers";
import { getSocialProviderAvailability } from "@/lib/auth/social-config";
import {
  getPreparedInviteCookieName,
  getRegistrationTicketCookieName,
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
  return <RegisterForm
    canonicalOrigin={getCanonicalAuthOrigin()}
    socialProviders={getSocialProviderAvailability()}
    initialInviteReady={Boolean(prepared || reserved)}
  />;
}
