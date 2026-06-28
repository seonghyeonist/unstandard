/**
 * Server-side Supabase alpha adapter configuration.
 *
 * Prefer UNSTANDARD_* env names (server-only on Vercel).
 * Legacy NEXT_PUBLIC_SUPABASE_* is read only as a temporary fallback — do not add new usages.
 */

export type ServerSupabaseConfig = {
  url?: string;
  publishableKey?: string;
};

export function getServerSupabaseConfig(): ServerSupabaseConfig {
  const url =
    process.env.UNSTANDARD_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    undefined;

  const publishableKey =
    process.env.UNSTANDARD_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    undefined;

  return { url, publishableKey };
}

export function isServerSupabaseConfigured(): boolean {
  const { url, publishableKey } = getServerSupabaseConfig();
  return Boolean(url && publishableKey);
}

export function requireServerSupabaseConfig(): { url: string; publishableKey: string } {
  const { url, publishableKey } = getServerSupabaseConfig();
  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured");
  }
  return { url, publishableKey };
}

export function getSupabaseOAuthProvider(): string | undefined {
  const value = process.env.UNSTANDARD_SUPABASE_OAUTH_PROVIDER?.trim();
  return value || undefined;
}
