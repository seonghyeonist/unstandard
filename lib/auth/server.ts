import "server-only";

import { headers } from "next/headers";
import { isDatabaseAuthConfigured, isMockAuthAllowed } from "@/lib/config/auth-mode";
import { getAuth } from "@/lib/auth/auth";
import { clearMockSessionUser, getMockSessionUser } from "@/lib/auth/mock-session.server";
import { isUserInviteFinalized } from "@/lib/auth/invite-finalization";
import { ensureProfileForUser } from "@/lib/db/repositories/profile-bootstrap";
import { DatabaseError, translateDatabaseError } from "@/lib/db/errors";

export type AuthenticatedUser = {
  id: string;
  email?: string | null;
  nickname?: string;
  onboarded?: boolean;
};

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message = "Service temporarily unavailable") {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

function isDatabaseOutage(error: unknown): boolean {
  if (error instanceof DatabaseError) {
    return error.code === "UNKNOWN";
  }
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("connect") ||
    message.includes("timeout") ||
    message.includes("econnrefused") ||
    message.includes("fetch failed")
  );
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (isMockAuthAllowed()) {
    const mockUser = await getMockSessionUser();
    if (!mockUser) return null;
    return {
      id: mockUser.id,
      nickname: mockUser.nickname,
      onboarded: mockUser.onboarded,
    };
  }

  if (!isDatabaseAuthConfigured()) {
    return null;
  }

  const auth = getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  let finalized = false;
  try {
    finalized = await isUserInviteFinalized(session.user.id);
  } catch (error) {
    if (isDatabaseOutage(error)) {
      throw new ServiceUnavailableError();
    }
    throw error;
  }

  if (!finalized) {
    await auth.api.signOut({ headers: await headers() });
    return null;
  }

  try {
    const profile = await ensureProfileForUser({
      id: session.user.id,
      email: session.user.email,
    });
    return {
      id: session.user.id,
      email: session.user.email,
      nickname: profile.nickname,
      onboarded: profile.onboarded,
    };
  } catch (error) {
    if (isDatabaseOutage(error)) {
      throw new ServiceUnavailableError();
    }
    const translated = translateDatabaseError(error);
    if (translated.code === "UNKNOWN") {
      throw new ServiceUnavailableError(translated.message);
    }
    throw new Error(`Profile invariant failure: ${translated.message}`);
  }
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new AuthError();
  }
  return user;
}

export function assertOwnsResource(sessionUserId: string, resourceUserId: string): void {
  if (sessionUserId !== resourceUserId) {
    throw new AuthError("Forbidden");
  }
}

export async function signOutCurrentUser(): Promise<void> {
  if (isMockAuthAllowed()) {
    await clearMockSessionUser();
    return;
  }

  const auth = getAuth();
  await auth.api.signOut({
    headers: await headers(),
  });
}
