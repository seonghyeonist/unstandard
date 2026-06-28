import { createBrowserClient } from "@supabase/ssr";
import { getServerSupabaseConfig } from "@/lib/config/supabase-config";

/**
 * Browser Supabase client — publishable key only.
 *
 * WARNING: Not used by the minimal staging login flow (server routes handle auth).
 * `getServerSupabaseConfig()` reads `UNSTANDARD_*` server env, which is NOT available
 * in the browser bundle. This client only works when legacy `NEXT_PUBLIC_SUPABASE_*`
 * fallback vars are set. Do NOT import from login flow or user-scoped auth paths.
 * Prefer server routes under `app/api/auth/supabase/` and `app/auth/callback/`.
 *
 * NEVER import service role or server secrets here.
 */
export function createClient() {
  const { url, publishableKey } = getServerSupabaseConfig();
  if (!url || !publishableKey) {
    throw new Error("Supabase env is not configured");
  }
  return createBrowserClient(url, publishableKey);
}
