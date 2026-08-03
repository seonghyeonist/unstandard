import "server-only";

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

  return user;
}
