import { CookieJar } from "./cookie-jar";

export type SessionProbe = {
  status: number;
};

export type LogoutProbe = {
  status: number;
};

/**
 * Three distinct session proofs — never collapse into one boolean.
 *
 * 1. logout_invalidates_session — normal logout leaves the active jar unauthenticated
 * 2. cleared_cookie_denied — local jar clear (no logout) yields anonymous denial
 * 3. revoked_session_rejected — stale PRE-LOGOUT jar replay after server logout
 */
export async function proveLogoutInvalidatesSession(args: {
  jar: CookieJar;
  getSession: (jar: CookieJar) => Promise<SessionProbe>;
  logout: (jar: CookieJar) => Promise<LogoutProbe>;
}): Promise<boolean> {
  const before = await args.getSession(args.jar);
  if (before.status !== 200) return false;
  const logout = await args.logout(args.jar);
  if (!(logout.status >= 200 && logout.status < 300)) return false;
  const after = await args.getSession(args.jar);
  return after.status === 401;
}

export async function proveClearedCookieDenied(args: {
  jar: CookieJar;
  getSession: (jar: CookieJar) => Promise<SessionProbe>;
}): Promise<boolean> {
  const before = await args.getSession(args.jar);
  if (before.status !== 200) return false;
  args.jar.clear();
  const after = await args.getSession(args.jar);
  return after.status === 401;
}

/**
 * Sign-in → confirm → clone stale jar → logout on live jar →
 * confirm post-logout 401 → replay stale pre-logout jar → require 401.
 */
export async function proveRevokedSessionRejected(args: {
  jar: CookieJar;
  getSession: (jar: CookieJar) => Promise<SessionProbe>;
  logout: (jar: CookieJar) => Promise<LogoutProbe>;
}): Promise<{ pass: boolean; usedStaleClone: boolean }> {
  const before = await args.getSession(args.jar);
  if (before.status !== 200) {
    return { pass: false, usedStaleClone: false };
  }

  const stalePreLogoutJar = args.jar.clone();
  if (stalePreLogoutJar.size() === 0) {
    return { pass: false, usedStaleClone: false };
  }

  const logout = await args.logout(args.jar);
  if (!(logout.status >= 200 && logout.status < 300)) {
    return { pass: false, usedStaleClone: true };
  }

  const postLogout = await args.getSession(args.jar);
  if (postLogout.status !== 401) {
    return { pass: false, usedStaleClone: true };
  }

  const staleReplay = await args.getSession(stalePreLogoutJar);
  return { pass: staleReplay.status === 401, usedStaleClone: true };
}
