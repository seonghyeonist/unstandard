/**
 * Client-safe auth mode flags (NEXT_PUBLIC_* only).
 */

export function isSupabaseAuthEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isMockAuthAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return !isSupabaseAuthEnabled();
}
