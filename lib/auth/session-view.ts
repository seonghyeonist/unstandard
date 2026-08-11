import type { AuthenticatedUser } from "@/lib/auth/server";

export type PublicSessionUser = {
  nickname: string;
  onboarded: boolean;
  idPrefix: string;
};

/** Maps server auth user to a client-safe session view — no id, email, or tokens. */
export function toPublicSessionUser(user: AuthenticatedUser): PublicSessionUser {
  const idPrefix = user.id.replace(/-/g, "").slice(0, 8);

  return {
    nickname: user.nickname ?? `user-${idPrefix}`,
    onboarded: user.onboarded ?? false,
    idPrefix,
  };
}
