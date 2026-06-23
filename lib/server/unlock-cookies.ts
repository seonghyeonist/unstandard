import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_PREFIX = "unstandard_unlock_";

function cookieSecret(): string {
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_COOKIE_SECRET is required in production");
  }
  return secret ?? "dev-only-insecure-local-demo";
}

function sign(profileId: string, userId: string): string {
  return createHmac("sha256", cookieSecret()).update(`${profileId}:${userId}`).digest("hex");
}

export async function setUnlockCookie(profileId: string, userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_PREFIX + profileId, sign(profileId, userId), {
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

  const expected = sign(profileId, userId);
  if (value.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export async function clearUnlockCookie(profileId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_PREFIX + profileId);
}
