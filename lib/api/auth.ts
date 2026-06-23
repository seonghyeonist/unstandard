import { isMockAuthAllowed } from "@/lib/config/auth-mode-client";
import type { CurrentUser } from "@/types/user";

const USER_KEY = "unstandard.alpha.user";

function fallbackUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as CurrentUser) : null;
}

function saveFallbackUser(user: CurrentUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    window.sessionStorage.removeItem(USER_KEY);
    return;
  }
  window.sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch("/api/auth/session", { credentials: "include" });
    if (response.ok) {
      const data = (await response.json()) as { user: CurrentUser | null };
      if (data.user) {
        saveFallbackUser(data.user);
        return data.user;
      }
    }
  } catch {
    // fall through to legacy sessionStorage in dev mock only
  }

  if (!isMockAuthAllowed()) return null;
  return fallbackUser();
}

export async function login(nickname = "손님"): Promise<CurrentUser> {
  if (!isMockAuthAllowed()) {
    throw new Error("Mock auth is disabled. Configure Supabase Auth.");
  }

  const user: CurrentUser = {
    id: "11111111-1111-1111-1111-111111111111",
    nickname,
    onboarded: false,
  };
  saveFallbackUser(user);
  return user;
}

export async function markOnboarded(nickname: string): Promise<CurrentUser> {
  if (!isMockAuthAllowed()) {
    throw new Error("Mock auth is disabled. Configure Supabase Auth.");
  }

  const existing = fallbackUser();
  const user: CurrentUser = {
    id: existing?.id ?? "11111111-1111-1111-1111-111111111111",
    nickname,
    onboarded: true,
  };
  saveFallbackUser(user);
  return user;
}

export async function logout(): Promise<void> {
  saveFallbackUser(null);
}
