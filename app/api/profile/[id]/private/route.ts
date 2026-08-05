import { getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { getPrivateProfileContent } from "@/lib/data/mock-private.server";
import { publicProfiles } from "@/lib/data/mock-public";
import { getDbPrivateProfile } from "@/lib/db/repositories/profile-private.repository";
import { privateJson } from "@/lib/http/private-json";
import { hasUnlockCookie } from "@/lib/server/unlock-cookies";
import {
  unlockErrorClientMessage,
  unlockErrorHttpStatus,
  type UnlockErrorCode,
} from "@/lib/unlock/unlock-codes";
import { createCorrelationId } from "@/lib/server/unlock/unlock-logger";

/**
 * Private profile route.
 * - Mock runtime: mock publicProfiles IDs + unlock cookie (local only).
 * - Database runtime: Neon profiles + unlocks row authorization (never cookies).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = createCorrelationId();

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

  const { id } = await context.params;

  if (isDatabaseRuntime()) {
    const result = await getDbPrivateProfile({
      viewerUserId: user.id,
      profileId: id,
    });

    if (!result.ok) {
      if (result.code === "FORBIDDEN") {
        return privateJson(
          { error: "Forbidden", code: "FORBIDDEN", correlationId: result.correlationId },
          { status: 403 },
        );
      }
      if (result.code === "PRIVATE_NOT_FOUND") {
        return privateJson(
          {
            error: "Private content not found",
            code: "PRIVATE_NOT_FOUND",
            correlationId: result.correlationId,
          },
          { status: 404 },
        );
      }
      const code = result.code as UnlockErrorCode;
      return privateJson(
        {
          error: unlockErrorClientMessage(code),
          code,
          correlationId: result.correlationId,
        },
        { status: unlockErrorHttpStatus(code) },
      );
    }

    return privateJson({
      ...result.body,
      correlationId: result.correlationId,
      source: "database",
    });
  }

  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return privateJson(
      { error: "Invalid profile id", code: "INVALID_PROFILE_ID", correlationId },
      { status: 400 },
    );
  }

  const exists = publicProfiles.some((profile) => profile.id === id);
  if (!exists) {
    return privateJson(
      { error: "Profile not found", code: "PROFILE_NOT_FOUND", correlationId },
      { status: 404 },
    );
  }

  const unlocked = await hasUnlockCookie(id, user.id);
  if (!unlocked) {
    return privateJson({ error: "Forbidden", code: "FORBIDDEN", correlationId }, { status: 403 });
  }

  const privateContent = getPrivateProfileContent(id);
  if (!privateContent) {
    return privateJson(
      { error: "Private content not found", code: "PRIVATE_NOT_FOUND", correlationId },
      { status: 404 },
    );
  }

  return privateJson({ ...privateContent, correlationId, source: "mock" });
}
