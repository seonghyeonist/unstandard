"use server";

import { isMockAuthAllowed } from "@/lib/config/auth-mode";
import { setMockSessionUser } from "@/lib/auth/mock-session.server";

const MOCK_USER_ID = "11111111-1111-1111-1111-111111111111";

export async function startMockSession(nickname = "손님") {
  if (!isMockAuthAllowed()) {
    throw new Error("Mock auth is disabled. Configure Supabase Auth for this environment.");
  }

  const user = { id: MOCK_USER_ID, nickname, onboarded: false };
  await setMockSessionUser(user);
  return user;
}

export async function completeMockOnboarding(nickname: string) {
  if (!isMockAuthAllowed()) {
    throw new Error("Mock auth is disabled. Configure Supabase Auth for this environment.");
  }

  const user = { id: MOCK_USER_ID, nickname, onboarded: true };
  await setMockSessionUser(user);
  return user;
}
