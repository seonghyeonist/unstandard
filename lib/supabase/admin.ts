import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseConfig } from "@/lib/config/supabase-config";

/**
 * Service-role client — SERVER ONLY.
 * Do not import from client components, pages with "use client", or shared client bundles.
 * Reserved for future admin/migration tasks; not wired in MVP routes yet.
 */
export function createAdminClient() {
  const { url } = getServerSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin env is not configured");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
