/**
 * @deprecated Prefer server-provided auth mode props on /login.
 * Client bundles cannot read UNSTANDARD_* server env; do not expand NEXT_PUBLIC Supabase usage.
 */

export function isSupabaseAuthEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isMockAuthAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return !isSupabaseAuthEnabled();
}
