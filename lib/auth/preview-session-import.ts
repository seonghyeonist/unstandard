import { createHash, createHmac } from "node:crypto";
import { canOperateSandboxPurges } from "@/lib/identity/operator-purge-policy";

// A temporary, named RC fixture scope. Never broaden this to Production.
export function canImportPreviewSession(env: Record<string, string | undefined>, now = Date.now(), expectedHostSha12 = "92f505134698"): boolean {
  if (!canOperateSandboxPurges(env) || now >= Date.parse("2026-10-12T23:59:00Z")) return false;
  try {
    const db = new URL(env.DATABASE_URL ?? "");
    return db.hostname.endsWith(".neon.tech") && db.pathname === "/unstandard_rc_it_20260929_0940a" && createHash("sha256").update(db.hostname.toLowerCase().replace(/-pooler(?=\.)/g, "")).digest("hex").slice(0, 12) === expectedHostSha12;
  } catch { return false; }
}

/** Better Call's installed signCookieValue wire format; secret stays server-side. */
export function existingSessionCookie(token: string, secret: string): string {
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(token) || !secret) throw new Error("Invalid session input");
  return `__Secure-better-auth.session_token=${encodeURIComponent(`${token}.${createHmac("sha256", secret).update(token).digest("base64")}`)}`;
}
