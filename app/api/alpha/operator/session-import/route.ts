import { eq } from "drizzle-orm";
import { hasOperatorSession } from "@/lib/alpha/operator-auth";
import { getAuth } from "@/lib/auth/auth";
import { isUserInviteFinalized } from "@/lib/auth/invite-finalization";
import { canImportPreviewSession, existingSessionCookie } from "@/lib/auth/preview-session-import";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema/profiles";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation } from "@/lib/http/profile-request";
import { isCanonicalUuid } from "@/lib/server/unlock/uuid";

export async function POST(request: Request) {
  if (!canImportPreviewSession(process.env)) return privateJson({ error: "Not available" }, { status: 404 });
  if (!isSameOriginMutation(request) || !(await hasOperatorSession())) return privateJson({ error: "Unauthorized" }, { status: 403 });
  try {
    const body = await request.json();
    if (typeof body?.sessionToken !== "string" || typeof body?.profileId !== "string" || !isCanonicalUuid(body.profileId)) {
      return privateJson({ error: "Invalid input" }, { status: 400 });
    }
    const cookie = existingSessionCookie(body.sessionToken, process.env.BETTER_AUTH_SECRET?.trim() ?? "");
    // Normal Better Auth validation: existing DB token, user, expiry and revocation.
    // Parent authority is never inferred from a caller-supplied user ID.
    const session = await getAuth().api.getSession({ headers: new Headers({ cookie }), query: { disableRefresh: true } });
    if (!session?.user || !(await isUserInviteFinalized(session.user.id))) return privateJson({ error: "Unauthorized" }, { status: 401 });
    const [profile] = await getDb().select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, session.user.id)).limit(1);
    if (profile?.id !== body.profileId) return privateJson({ error: "Unauthorized" }, { status: 403 });
    const remaining = Math.floor((new Date(session.session.expiresAt).getTime() - Date.now()) / 1000);
    if (remaining <= 0) return privateJson({ error: "Unauthorized" }, { status: 401 });
    // Issue a short-lived child through the normal auth adapter after validating
    // the existing parent. Logout tests revoke the child, preserving human login.
    const expiresAt = new Date(Math.min(new Date(session.session.expiresAt).getTime(), Date.now() + 900_000));
    const context = await getAuth().$context;
    const child = await context.internalAdapter.createSession(session.user.id, true, { expiresAt, userAgent: "unstandard-rc-acceptance-delegation" }, true);
    if (!child) return privateJson({ error: "Session unavailable" }, { status: 503 });
    const childCookie = existingSessionCookie(child.token, process.env.BETTER_AUTH_SECRET?.trim() ?? "");
    const response = privateJson({ ok: true, authenticationMode: "delegated_issued_sessions" });
    response.headers.set("Set-Cookie", `${childCookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.min(remaining, 900)}`);
    console.info(JSON.stringify({ event: "alpha.session_import", code: "PARENT_VALIDATED_CHILD_ISSUED" }));
    return response;
  } catch {
    return privateJson({ error: "Invalid session input" }, { status: 400 });
  }
}
