import type { AuthenticatedUser } from "@/lib/auth/server";

const MAX_NICKNAME_LENGTH = 64;

/** Pure nickname fallback for minimal profile bootstrap rows. */
export function resolveReporterNickname(user: AuthenticatedUser): string {
  const fromNickname = user.nickname?.trim();
  if (fromNickname) {
    return fromNickname.slice(0, MAX_NICKNAME_LENGTH);
  }

  const emailLocal = user.email?.split("@")[0]?.trim();
  if (emailLocal) {
    return emailLocal.slice(0, MAX_NICKNAME_LENGTH);
  }

  return `user-${user.id.replace(/-/g, "").slice(0, 8)}`;
}
