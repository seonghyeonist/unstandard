import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profilePrivate, profiles } from "@/lib/db/schema/profiles";
import { hasUnlock } from "@/lib/db/repositories/unlocks.repository";
import { isUuid } from "@/lib/server/unlock/uuid";
import {
  createCorrelationId,
  idPrefix,
  logDatabaseFailure,
  logUnlockEvent,
} from "@/lib/server/unlock/unlock-logger";
import type { UnlockErrorCode } from "@/lib/unlock/unlock-codes";

export type PrivateProfilePayload = {
  letter: string;
  smallJoys: string[];
};

export type GetPrivateProfileResult =
  | { ok: true; correlationId: string; body: PrivateProfilePayload }
  | { ok: false; correlationId: string; code: UnlockErrorCode | "FORBIDDEN" | "PRIVATE_NOT_FOUND" };

/**
 * DB-backed private profile:
 * authorization source = unlocks(viewer_user_id, profile_id) only.
 * Signed cookies are never consulted.
 */
export async function getDbPrivateProfile(input: {
  viewerUserId: string;
  profileId: string;
}): Promise<GetPrivateProfileResult> {
  const correlationId = createCorrelationId();
  const profileId = input.profileId.trim();

  if (!isUuid(profileId)) {
    return { ok: false, correlationId, code: "INVALID_PROFILE_ID" };
  }

  const db = getDb();

  let profileRow: { id: string; userId: string } | undefined;
  try {
    const [row] = await db
      .select({ id: profiles.id, userId: profiles.userId })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    profileRow = row;
  } catch (error) {
    logDatabaseFailure({
      correlationId,
      stage: "TARGET_LOOKUP",
      code: "UNLOCK_SERVICE_UNAVAILABLE",
      error,
      viewerUserIdPrefix: idPrefix(input.viewerUserId),
      targetProfileIdPrefix: idPrefix(profileId),
    });
    return { ok: false, correlationId, code: "UNLOCK_SERVICE_UNAVAILABLE" };
  }

  if (!profileRow) {
    logUnlockEvent({
      event: "private.not_found",
      correlationId,
      stage: "TARGET_LOOKUP",
      status: "error",
      code: "PROFILE_NOT_FOUND",
      viewerUserIdPrefix: idPrefix(input.viewerUserId),
      targetProfileIdPrefix: idPrefix(profileId),
    });
    return { ok: false, correlationId, code: "PROFILE_NOT_FOUND" };
  }

  // Self-profile: still requires an unlock row (none by default; self-unlock denied on write).
  let unlocked = false;
  try {
    unlocked = await hasUnlock(input.viewerUserId, profileRow.id);
  } catch (error) {
    logDatabaseFailure({
      correlationId,
      stage: "PRIVATE_AUTHORIZATION",
      code: "UNLOCK_SERVICE_UNAVAILABLE",
      error,
      viewerUserIdPrefix: idPrefix(input.viewerUserId),
      targetProfileIdPrefix: idPrefix(profileRow.id),
    });
    return { ok: false, correlationId, code: "UNLOCK_SERVICE_UNAVAILABLE" };
  }

  if (!unlocked) {
    logUnlockEvent({
      event: "private.forbidden",
      correlationId,
      stage: "PRIVATE_AUTHORIZATION",
      status: "error",
      code: "FORBIDDEN",
      viewerUserIdPrefix: idPrefix(input.viewerUserId),
      targetProfileIdPrefix: idPrefix(profileRow.id),
    });
    return { ok: false, correlationId, code: "FORBIDDEN" };
  }

  try {
    const [privateRow] = await db
      .select({
        letter: profilePrivate.letter,
        smallJoys: profilePrivate.smallJoys,
      })
      .from(profilePrivate)
      .where(eq(profilePrivate.profileId, profileRow.id))
      .limit(1);

    if (!privateRow) {
      logUnlockEvent({
        event: "private.missing_row",
        correlationId,
        stage: "PRIVATE_FETCH",
        status: "error",
        code: "PRIVATE_NOT_FOUND",
        viewerUserIdPrefix: idPrefix(input.viewerUserId),
        targetProfileIdPrefix: idPrefix(profileRow.id),
      });
      return { ok: false, correlationId, code: "PRIVATE_NOT_FOUND" };
    }

    logUnlockEvent({
      event: "private.ok",
      correlationId,
      stage: "PRIVATE_FETCH",
      status: "ok",
      viewerUserIdPrefix: idPrefix(input.viewerUserId),
      targetProfileIdPrefix: idPrefix(profileRow.id),
    });

    return {
      ok: true,
      correlationId,
      body: {
        letter: privateRow.letter ?? "",
        smallJoys: privateRow.smallJoys ?? [],
      },
    };
  } catch (error) {
    logDatabaseFailure({
      correlationId,
      stage: "PRIVATE_FETCH",
      code: "UNLOCK_SERVICE_UNAVAILABLE",
      error,
      viewerUserIdPrefix: idPrefix(input.viewerUserId),
      targetProfileIdPrefix: idPrefix(profileRow.id),
    });
    return { ok: false, correlationId, code: "UNLOCK_SERVICE_UNAVAILABLE" };
  }
}
