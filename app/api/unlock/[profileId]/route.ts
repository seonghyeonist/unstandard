import { getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { privateJson } from "@/lib/http/private-json";
import { hasUnlockCookie } from "@/lib/server/unlock-cookies";
import { getDbUnlockStatus } from "@/lib/server/unlock/db-unlock.service";
import {
  unlockErrorClientMessage,
  unlockErrorHttpStatus,
} from "@/lib/unlock/unlock-codes";
import { createCorrelationId } from "@/lib/server/unlock/unlock-logger";

export async function GET(_request: Request, context: { params: Promise<{ profileId: string }> }) {
  const correlationId = createCorrelationId();
  const { profileId } = await context.params;

  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return privateJson(
        {
          error: unlockErrorClientMessage("UNLOCK_SERVICE_UNAVAILABLE"),
          code: "UNLOCK_SERVICE_UNAVAILABLE",
          correlationId,
        },
        { status: 503 },
      );
    }
    return privateJson(
      { error: unlockErrorClientMessage("UNAUTHORIZED"), code: "UNAUTHORIZED", correlationId },
      { status: 401 },
    );
  }
  if (!user) {
    return privateJson(
      { error: unlockErrorClientMessage("UNAUTHORIZED"), code: "UNAUTHORIZED", correlationId },
      { status: 401 },
    );
  }

  if (isDatabaseRuntime()) {
    const result = await getDbUnlockStatus({
      viewerUserId: user.id,
      profileId,
    });
    if (!result.ok) {
      return privateJson(
        {
          error: unlockErrorClientMessage(result.code),
          code: result.code,
          correlationId: result.correlationId,
        },
        { status: unlockErrorHttpStatus(result.code) },
      );
    }
    return privateJson({
      profileId: result.profileId,
      unlocked: result.unlocked,
      correlationId: result.correlationId,
      source: "database",
    });
  }

  if (!profileId || !/^[a-zA-Z0-9_-]+$/.test(profileId)) {
    return privateJson(
      { error: "Invalid profileId", code: "INVALID_PROFILE_ID", correlationId },
      { status: 400 },
    );
  }

  const unlocked = await hasUnlockCookie(profileId, user.id);
  return privateJson({ profileId, unlocked, correlationId, source: "mock" });
}
