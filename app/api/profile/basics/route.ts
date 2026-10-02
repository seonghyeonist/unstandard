import { AuthError, requireAuthenticatedUser } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation, readSmallJson } from "@/lib/http/profile-request";
import { profileBasicsSchema } from "@/lib/profile/basics";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { readProfileSetup, saveProfileBasics, withdrawProfileBasics } from "@/lib/server/profile/profile-basics.service";

export async function GET() {
  try {
    if (!isDatabaseRuntime()) return privateJson({ error: "Database required" }, { status: 503 });
    const user = await requireAuthenticatedUser();
    return privateJson(await readProfileSetup(user.id));
  } catch (e) { return privateJson({ error: "Profile unavailable" }, { status: e instanceof AuthError ? 401 : 503 }); }
}
async function mutate(request: Request, remove: boolean) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Forbidden" }, { status: 403 });
  try {
    if (!isDatabaseRuntime()) return privateJson({ error: "Database required" }, { status: 503 });
    const user = await requireAuthenticatedUser();
    const limit = await consumeRateLimit({ scope: "profileBasics", subject: user.id });
    if (!limit.allowed) return privateJson({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    if (remove) await withdrawProfileBasics(user.id);
    else {
      let body;
      try { body = profileBasicsSchema.parse(await readSmallJson(request)); }
      catch { return privateJson({ error: "Invalid profile fields" }, { status: 400 }); }
      await saveProfileBasics(user.id, body);
    }
    return privateJson(await readProfileSetup(user.id));
  } catch (e) { return privateJson({ error: "Profile unavailable" }, { status: e instanceof AuthError ? 401 : 503 }); }
}
export async function PUT(request: Request) { return mutate(request, false); }
export async function DELETE(request: Request) { return mutate(request, true); }
