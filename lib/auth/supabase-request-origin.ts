import "server-only";

import { headers } from "next/headers";

/** Resolves the public origin for Supabase auth redirect URLs. */
export async function getSupabaseAuthRedirectOrigin(): Promise<string> {
  const configured = process.env.UNSTANDARD_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (!host) {
    return "http://localhost:3000";
  }

  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
