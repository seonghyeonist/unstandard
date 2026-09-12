"use server";

import { cookies, headers } from "next/headers";
import { isDatabaseAuthConfigured, isMockAuthAllowed } from "@/lib/config/auth-mode";
import { getAuth } from "@/lib/auth/auth";
import { isAcceptableNewPassword } from "@/lib/auth/password-policy";
import {
  getRegistrationTicketCookieName,
  verifyRegistrationTicket,
} from "@/lib/auth/invite-ticket";
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
  let result;
  try {
    result = await auth.api.signInEmail({
      body: {
        email: normalized,
        password,
      },
      headers: await headers(),
    });
  } catch {
    throw new Error("Email or password is incorrect.");
  }

  if (!result?.user) {
    throw new Error("Email or password is incorrect.");
  }

  return { ok: true as const };
}

export async function completeInviteSignup(password: string) {
  if (!isDatabaseAuthConfigured()) {
    throw new Error("Database auth is not configured for this environment.");
  }

  if (!isAcceptableNewPassword(password)) {
    throw new Error("Password does not meet the minimum security requirements.");
  }

  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  const cookieStore = await cookies();
  const ticket = secret
    ? verifyRegistrationTicket(cookieStore.get(getRegistrationTicketCookieName())?.value ?? "", secret)
    : null;
  if (!ticket) throw new Error("Invite verification expired. Start again from your invitation link.");

  const auth = getAuth();
  let result;
  try {
    result = await auth.api.signUpEmail({
      body: {
        name: "Member",
        email: ticket.email,
        password,
      },
      headers: await headers(),
    });
  } catch {
    throw new Error("Could not create this account. Try signing in or resetting the password if the email is already registered.");
  }

  if (!result?.user) {
    throw new Error("Could not create this account.");
  }

  return { ok: true as const };
}
