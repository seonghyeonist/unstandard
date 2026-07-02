import type { AuthenticatedUser } from "@/lib/auth/server";

export type PublicSessionUser = {
  nickname: string;
  onboarded: boolean;
  idPrefix: string;
};

export type SessionViewOptions = {
  supabaseAuth: boolean;
  answersPersistenceEnabled?: boolean;
};

/** Maps server auth user to a client-safe session view — no id, email, or tokens. */
export function toPublicSessionUser(
  user: AuthenticatedUser,
  options: SessionViewOptions,
): PublicSessionUser {
  const idPrefix = user.id.replace(/-/g, "").slice(0, 8);
  const stagingBypass =
    options.supabaseAuth && options.answersPersistenceEnabled !== true;

  return {
    nickname: user.nickname ?? `user-${idPrefix}`,
    onboarded: user.onboarded ?? (stagingBypass ? true : false),
    idPrefix,
  };
}
