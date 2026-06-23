import "server-only";

import { cookies } from "next/headers";
import { isMockAuthAllowed, isSupabaseAuthEnabled } from "@/lib/config/auth-mode";
import type { AuthenticatedUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const MOCK_SESSION_COOKIE = "unstandard_mock_session";

export type MockSessionUser = {
  id: string;
  nickname: string;
  onboarded: boolean;
};

export async function getMockSessionUser(): Promise<MockSessionUser | null> {
  if (!isMockAuthAllowed()) return null;
  const cookieStore = await cookies();
  const raw = cookieStore.get(MOCK_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MockSessionUser;
  } catch {
    return null;
  }
}

export async function setMockSessionUser(user: MockSessionUser): Promise<void> {
  if (!isMockAuthAllowed()) {
    throw new Error("Mock auth is not allowed in this environment");
  }
  const cookieStore = await cookies();
  cookieStore.set(MOCK_SESSION_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearMockSessionUser(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(MOCK_SESSION_COOKIE);
}

export async function resolveSessionUser(): Promise<(AuthenticatedUser & { nickname?: string; onboarded?: boolean }) | null> {
  if (isSupabaseAuthEnabled()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return { id: user.id, email: user.email };
  }

  const mockUser = await getMockSessionUser();
  if (!mockUser) return null;
  return { id: mockUser.id, nickname: mockUser.nickname, onboarded: mockUser.onboarded };
}
