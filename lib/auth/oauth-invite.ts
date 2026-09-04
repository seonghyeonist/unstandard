import { normalizeEmail } from "@/lib/auth/invite-crypto";

/** OAuth registration is allowed only when the provider email matches the reserved invite. */
export function oauthInviteEmailMatches(oauthEmail: string, inviteEmail: string): boolean {
  const normalizedOAuthEmail = normalizeEmail(oauthEmail);
  const normalizedInviteEmail = normalizeEmail(inviteEmail);
  return Boolean(normalizedOAuthEmail && normalizedInviteEmail && normalizedOAuthEmail === normalizedInviteEmail);
}

export function oauthInviteRegistrationAllowed(input: {
  oauthEmail?: string | null;
  inviteEmail?: string | null;
  reservationValid: boolean;
}): boolean {
  return input.reservationValid && Boolean(input.oauthEmail && input.inviteEmail) &&
    oauthInviteEmailMatches(input.oauthEmail ?? "", input.inviteEmail ?? "");
}
