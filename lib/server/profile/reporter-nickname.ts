import type { AuthenticatedUser } from "@/lib/auth/server";

const MAX_NICKNAME_LENGTH = 64;

/** Pure nickname fallback for minimal profile bootstrap rows. Never derives from email. */
export function resolveReporterNickname(user: AuthenticatedUser): string {
  const fromNickname = user.nickname?.trim();
  if (fromNickname) {
    return fromNickname.slice(0, MAX_NICKNAME_LENGTH);
  }

  return `user-${user.id.replace(/-/g, "").slice(0, 8)}`;
}
