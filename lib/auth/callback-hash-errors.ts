/** Parses Supabase auth error_code from a URL hash fragment (client-only). */
export function parseAuthHashErrorCode(hash: string): string | null {
  const trimmed = hash.replace(/^#/, "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URLSearchParams(trimmed).get("error_code");
  } catch {
    return null;
  }
}

export function resolveCallbackHashLoginMessage(errorCode: string | null): string | null {
  if (errorCode === "otp_expired") {
    return "Magic link expired or already used. Discard old emails and request one fresh link after the rate limit clears.";
  }
  if (errorCode === "access_denied") {
    return "Sign-in was denied. Request a new magic link.";
  }
  return null;
}
