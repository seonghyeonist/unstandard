import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireServerSupabaseConfig } from "@/lib/config/supabase-config";

/**
 * Server Supabase client — session from HttpOnly cookies.
 * Use in Route Handlers, Server Actions, and Server Components only.
 */
export async function createClient() {
  const { url, publishableKey } = requireServerSupabaseConfig();

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll from Server Component — middleware handles refresh.
        }
      },
    },
  });
}
