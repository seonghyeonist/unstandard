/**
 * Server-side auth mode detection.
 * Mock auth is development-only theater — never a production alpha path.
 */

function isServerSupabaseConfigured(): boolean {
  const url =
    process.env.UNSTANDARD_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.UNSTANDARD_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && publishableKey);
}

export function isSupabaseAuthEnabled(): boolean {
  return isServerSupabaseConfigured();
}

export function isMockAuthAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return !isSupabaseAuthEnabled();
}
