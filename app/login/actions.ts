"use server";

import { isMockAuthAllowed, isSupabaseAuthEnabled } from "@/lib/config/auth-mode";
import { getSupabaseAuthRedirectOrigin } from "@/lib/auth/supabase-request-origin";
import { setMockSessionUser, clearMockSessionUser } from "@/lib/auth/mock-session.server";
import { createClient } from "@/lib/supabase/server";

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

export async function endMockSession() {
  await clearMockSessionUser();
}

export async function requestSupabaseMagicLink(email: string) {
  if (!isSupabaseAuthEnabled()) {
    throw new Error("Supabase Auth is not configured for this environment.");
  }

  const normalized = email.trim();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  const supabase = await createClient();
  const origin = await getSupabaseAuthRedirectOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    throw new Error("Magic link request failed. Check Supabase email auth settings.");
  }

  return { ok: true as const };
}
