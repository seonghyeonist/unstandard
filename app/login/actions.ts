"use server";

import { cookies, headers } from "next/headers";
import { isAPIError } from "better-auth/api";
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
    return { ok: false as const, errorCode: "service_unavailable" as const };
  }

  const normalized = email.trim();
  if (!normalized || !normalized.includes("@")) {
    return { ok: false as const, errorCode: "invalid_credentials" as const };
  }
  if (password.length < 10) {
    return { ok: false as const, errorCode: "invalid_credentials" as const };
  }

  try {
    const auth = getAuth();
    const result = await auth.api.signInEmail({
      body: {
        email: normalized,
        password,
      },
      headers: await headers(),
    });

    if (!result?.user) {
      return { ok: false as const, errorCode: "invalid_credentials" as const };
    }
  } catch (error) {
    if (isAPIError(error) && (error.status === "UNAUTHORIZED" || error.status === "FORBIDDEN")) {
      return { ok: false as const, errorCode: "invalid_credentials" as const };
    }

    // Keep infrastructure details and submitted credentials out of the
    // server-action response while ensuring expected auth failures aren't
    // surfaced as opaque React Server Component errors.
    console.error({ action: "email_password_sign_in_failed", code: "AUTH_SIGN_IN_FAILED" });
    return { ok: false as const, errorCode: "service_unavailable" as const };
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
