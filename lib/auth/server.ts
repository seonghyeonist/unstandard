import "server-only";

import { isSupabaseAuthEnabled } from "@/lib/config/auth-mode";
import { resolveSessionUser } from "@/lib/auth/mock-session.server";
import { createClient } from "@/lib/supabase/server";
import { loadProfileSessionFields } from "@/lib/server/profile/profile-session";

export type AuthenticatedUser = {
  id: string;
  email?: string | null;
  nickname?: string;
  onboarded?: boolean;
};

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (isSupabaseAuthEnabled()) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;

    const profileFields = await loadProfileSessionFields(user.id);
    return {
      id: user.id,
      email: user.email,
      nickname: profileFields?.nickname,
      onboarded: profileFields?.onboarded,
    };
  }

  return resolveSessionUser();
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new AuthError();
  }
  return user;
}

export function assertOwnsResource(sessionUserId: string, resourceUserId: string): void {
  if (sessionUserId !== resourceUserId) {
    throw new AuthError("Forbidden");
  }
}
