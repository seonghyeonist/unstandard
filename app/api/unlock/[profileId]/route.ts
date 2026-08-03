import { getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { privateJson } from "@/lib/http/private-json";
import { hasUnlockCookie } from "@/lib/server/unlock-cookies";

export async function GET(_request: Request, context: { params: Promise<{ profileId: string }> }) {
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return privateJson({ error: "Authentication service unavailable" }, { status: 503 });
    }
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }

  if (isDatabaseRuntime()) {
    return privateJson({ error: "Database-backed unlock is not available" }, { status: 503 });
  }

  const { profileId } = await context.params;
  if (!profileId || !/^[a-zA-Z0-9_-]+$/.test(profileId)) {
    return privateJson({ error: "Invalid profileId" }, { status: 400 });
  }

  const unlocked = await hasUnlockCookie(profileId, user.id);
  return privateJson({ profileId, unlocked });
}
