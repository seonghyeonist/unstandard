import { getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { publicProfiles } from "@/lib/data/mock-public";
import { getPublicProfileById } from "@/lib/db/repositories/candidates.repository";
import { privateJson } from "@/lib/http/private-json";
import {
  createCorrelationId,
  idPrefix,
  logUnlockEvent,
} from "@/lib/server/unlock/unlock-logger";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = createCorrelationId();
  const { id } = await context.params;

  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return privateJson(
        { error: "Service temporarily unavailable", code: "UNLOCK_SERVICE_UNAVAILABLE", correlationId },
        { status: 503 },
      );
    }
    return privateJson({ error: "Unauthorized", code: "UNAUTHORIZED", correlationId }, { status: 401 });
  }
  if (!user) {
    return privateJson({ error: "Unauthorized", code: "UNAUTHORIZED", correlationId }, { status: 401 });
  }

  if (!isDatabaseRuntime()) {
    const profile = publicProfiles.find((item) => item.id === id);
    if (!profile) {
      return privateJson({ error: "Profile not found", code: "PROFILE_NOT_FOUND", correlationId }, { status: 404 });
    }
    return privateJson(profile);
  }

  try {
    const result = await getPublicProfileById(id);
    if (result === "invalid") {
      return privateJson(
        { error: "Invalid profile id", code: "INVALID_PROFILE_ID", correlationId },
        { status: 400 },
      );
    }
    if (result === "question_missing") {
      return privateJson(
        { error: "Unlock question is not configured", code: "QUESTION_NOT_CONFIGURED", correlationId },
        { status: 409 },
      );
    }
    if (result === "not_found") {
      return privateJson(
        { error: "Profile not found", code: "PROFILE_NOT_FOUND", correlationId },
        { status: 404 },
      );
    }

    logUnlockEvent({
      event: "public_profile.ok",
      correlationId,
      stage: "PUBLIC_PROFILE",
      status: "ok",
      viewerUserIdPrefix: idPrefix(user.id),
      targetProfileIdPrefix: idPrefix(result.id),
    });

    return privateJson({
      id: result.id,
      nickname: result.nickname,
      city: result.city,
      teaser: result.teaser,
      question: result.question,
      locked: result.locked,
      correlationId,
    });
  } catch (error) {
    void error;
    return privateJson(
      {
        error: "Profile unavailable",
        code: "UNLOCK_SERVICE_UNAVAILABLE",
        correlationId,
      },
      { status: 503 },
    );
  }
}
