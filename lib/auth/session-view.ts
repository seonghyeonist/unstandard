import type { AuthenticatedUser } from "@/lib/auth/server";

export type PublicSessionUser = {
  id: string;
  nickname: string;
  onboarded: boolean;
  idPrefix: string;
};

/** Maps server auth user to a client-safe session view — no email, no tokens. */
export function toPublicSessionUser(
  user: AuthenticatedUser,
  options: { supabaseAuth: boolean },
): PublicSessionUser {
  const idPrefix = user.id.replace(/-/g, "").slice(0, 8);
  return {
    id: user.id,
    nickname: user.nickname ?? `user-${idPrefix}`,
    onboarded: user.onboarded ?? (options.supabaseAuth ? true : false),
    idPrefix,
  };
}
