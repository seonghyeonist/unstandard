import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client — anon key only.
 * NEVER import service role or server secrets here.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase env is not configured");
  }
  return createBrowserClient(url, anonKey);
}
