import type { CurrentUser } from "@/types/user";

/**
 * Client session reader — server session is the source of truth.
 * No sessionStorage. No production mock fallback.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { user: CurrentUser | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}
