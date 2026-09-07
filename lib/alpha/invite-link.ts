/** Build the capability-bearing invitation URL only at the operator boundary. */
export function registrationOrigin(env: Record<string, string | undefined> = process.env): string {
  const raw = env.UNSTANDARD_APP_URL?.trim() || env.BETTER_AUTH_URL?.trim();
  if (!raw) throw new Error("INVITE_REGISTRATION_ORIGIN_UNAVAILABLE");
  const parsed = new URL(raw);
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !local) throw new Error("INVITE_REGISTRATION_ORIGIN_UNSAFE");
  return parsed.origin;
}

/** The capability is intentionally kept in the URL fragment, never the query. */
export function buildInviteLink(rawCapability: string, origin = registrationOrigin()): string {
  if (!rawCapability || /[\r\n]/.test(rawCapability)) throw new Error("INVITE_CAPABILITY_INVALID");
  return `${origin}/register#invite=${encodeURIComponent(rawCapability)}`;
}
