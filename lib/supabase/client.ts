import { createBrowserClient } from "@supabase/ssr";
import { getServerSupabaseConfig } from "@/lib/config/supabase-config";

/**
 * Browser Supabase client — publishable key only.
 * Not used by the minimal staging login flow (server routes handle auth).
 * NEVER import service role or server secrets here.
 */
export function createClient() {
  const { url, publishableKey } = getServerSupabaseConfig();
  if (!url || !publishableKey) {
    throw new Error("Supabase env is not configured");
  }
  return createBrowserClient(url, publishableKey);
}
