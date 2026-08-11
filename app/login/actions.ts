"use server";

import { headers } from "next/headers";
import { isDatabaseAuthConfigured, isMockAuthAllowed } from "@/lib/config/auth-mode";
import { getAuth } from "@/lib/auth/auth";
import { setMockSessionUser, clearMockSessionUser } from "@/lib/auth/mock-session.server";

const MOCK_USER_ID = "11111111-1111-1111-1111-111111111111";

export async function startMockSession(nickname = "손님") {
  if (!isMockAuthAllowed()) {
    throw new Error("Mock auth is disabled. Configure database auth for this environment.");
  }

  const user = { id: MOCK_USER_ID, nickname, onboarded: false };
  await setMockSessionUser(user);
  return user;
}

export async function completeMockOnboarding(nickname: string) {
  if (!isMockAuthAllowed()) {
    throw new Error("Mock auth is disabled. Configure database auth for this environment.");
  }

  const user = { id: MOCK_USER_ID, nickname, onboarded: true };
  await setMockSessionUser(user);
  return user;
}

export async function endMockSession() {
  await clearMockSessionUser();
}

export async function signInWithEmailPassword(email: string, password: string) {
  if (!isDatabaseAuthConfigured()) {
    throw new Error("Database auth is not configured for this environment.");
  }

  const normalized = email.trim();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  if (password.length < 10) {
    throw new Error("Password must be at least 10 characters.");
  }

  const auth = getAuth();
  const result = await auth.api.signInEmail({
    body: {
      email: normalized,
      password,
    },
    headers: await headers(),
  });

  if (!result?.user) {
    throw new Error("Sign-in failed.");
  }

  return { ok: true as const };
}

export async function signUpWithEmailPassword(name: string, email: string, password: string) {
  if (!isDatabaseAuthConfigured()) {
    throw new Error("Database auth is not configured for this environment.");
  }

  const normalized = email.trim();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  if (password.length < 10) {
    throw new Error("Password must be at least 10 characters.");
  }

  const auth = getAuth();
  const result = await auth.api.signUpEmail({
    body: {
      name: name.trim() || "Member",
      email: normalized,
      password,
    },
    headers: await headers(),
  });

  if (!result?.user) {
    throw new Error("Registration failed.");
  }

  return { ok: true as const };
}
