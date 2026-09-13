import { getCanonicalAuthOrigin } from "@/lib/auth/canonical-origin";

/** Build the capability-bearing invitation URL only at the operator boundary. */
export function registrationOrigin(env: Record<string, string | undefined> = process.env): string {
  return getCanonicalAuthOrigin(env);
}

/** The capability is intentionally kept in the URL fragment, never the query. */
export function buildInviteLink(rawCapability: string, origin = registrationOrigin()): string {
  if (!rawCapability || /[\r\n]/.test(rawCapability)) throw new Error("INVITE_CAPABILITY_INVALID");
  return `${origin}/register#invite=${encodeURIComponent(rawCapability)}`;
}
