import "server-only";

import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { readProfileSetup } from "@/lib/server/profile/profile-basics.service";
import { redirect } from "next/navigation";
import {
  getAuthenticatedUser,
  ServiceUnavailableError,
  type AuthenticatedUser,
} from "@/lib/auth/server";

/**
 * Server-side guard for protected App Router segments.
 *
 * Client guards remain useful for hydration and stale-session UX, but they
 * must not be the first authorization boundary because client components are
 * rendered after the server has already produced a response.
 */
export async function requirePageUser(options: {
  requireOnboarded?: boolean;
  requireIntroduction?: boolean;
} = {}): Promise<AuthenticatedUser> {
  let user: AuthenticatedUser | null;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      redirect("/login?error=service_unavailable");
    }
    throw error;
  }

  if (!user) {
    redirect("/login");
  }

  if (options.requireOnboarded !== false && !user.onboarded) {
    redirect("/onboarding");
  }

  if (options.requireIntroduction && isDatabaseRuntime()) {
    let eligible = false;
    try { eligible = (await readProfileSetup(user.id)).eligible; } catch { redirect("/profile-setup"); }
    if (!eligible) redirect("/profile-setup");
  }

  return user;
}
