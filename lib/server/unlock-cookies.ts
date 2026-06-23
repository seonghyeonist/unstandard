import "server-only";

import { cookies } from "next/headers";
import { resolveCookieSecret, signUnlockToken, verifyUnlockToken } from "@/lib/server/unlock-signature";

const COOKIE_PREFIX = "unstandard_unlock_";

function cookieSecret(): string {
  return resolveCookieSecret(process.env.NODE_ENV, process.env.AUTH_COOKIE_SECRET);
}

export async function setUnlockCookie(profileId: string, userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_PREFIX + profileId, signUnlockToken(profileId, userId, cookieSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function hasUnlockCookie(profileId: string, userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_PREFIX + profileId)?.value;
  if (!value) return false;
  return verifyUnlockToken(profileId, userId, value, cookieSecret());
}

export async function clearUnlockCookie(profileId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_PREFIX + profileId);
}
