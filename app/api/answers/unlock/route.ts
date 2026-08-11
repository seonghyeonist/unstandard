import { getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { candidates } from "@/lib/data/mock-public";
import { evaluateDepthAnswer } from "@/lib/depth/evaluate-depth-answer";
import { privateJson } from "@/lib/http/private-json";
import { setUnlockCookie } from "@/lib/server/unlock-cookies";
import { submitDbUnlockAnswer } from "@/lib/server/unlock/db-unlock.service";
import {
  unlockErrorClientMessage,
  unlockErrorHttpStatus,
} from "@/lib/unlock/unlock-codes";
import { createCorrelationId } from "@/lib/server/unlock/unlock-logger";
import { consumeRateLimit, RateLimitUnavailableError } from "@/lib/security/rate-limit";

function questionForMockProfile(profileId: string): string {
  return candidates.find((candidate) => candidate.id === profileId)?.question ?? "";
}

export async function POST(request: Request) {
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

  try {
    const decision = await consumeRateLimit({ scope: "unlockAnswer", subject: user.id });
    if (!decision.allowed) {
      return privateJson(
        {
          error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          code: "RATE_LIMITED",
          correlationId,
        },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
      );
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return privateJson(
        {
          error: unlockErrorClientMessage("UNLOCK_SERVICE_UNAVAILABLE"),
          code: "UNLOCK_SERVICE_UNAVAILABLE",
          correlationId,
        },
        { status: 503 },
      );
    }
    throw error;
  }

  // Database runtime: DB-backed unlock (unlocks table is source of truth).
  if (isDatabaseRuntime()) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return privateJson(
        {
          error: unlockErrorClientMessage("INVALID_BODY"),
          code: "INVALID_BODY",
          correlationId,
        },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return privateJson(
        {
          error: unlockErrorClientMessage("INVALID_BODY"),
          code: "INVALID_BODY",
          correlationId,
        },
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;
    const profileId = typeof input.profileId === "string" ? input.profileId : "";
    const answer = typeof input.answer === "string" ? input.answer : "";

    const result = await submitDbUnlockAnswer({
      viewerUserId: user.id,
      profileId,
      answer,
    });

    if (!result.ok) {
      return privateJson(
        {
          error: unlockErrorClientMessage(result.code),
          code: result.code,
          correlationId: result.correlationId,
          verdict: "ERROR",
          reasonCodes: [],
        },
        { status: unlockErrorHttpStatus(result.code) },
      );
    }

    return privateJson({
      verdict: result.verdict,
      reasonCodes: result.reasonCodes,
      unlocked: result.unlocked,
      idempotent: result.idempotent,
      correlationId: result.correlationId,
    });
  }

  // Local mock runtime only: signed cookie unlock for mock candidate IDs.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON", code: "INVALID_BODY", correlationId }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return privateJson({ error: "Invalid body", code: "INVALID_BODY", correlationId }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const profileId = typeof input.profileId === "string" ? input.profileId.trim() : "";
  const answer = typeof input.answer === "string" ? input.answer.trim() : "";

  if (!profileId || profileId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(profileId)) {
    return privateJson(
      { error: "Invalid profileId", code: "INVALID_PROFILE_ID", correlationId },
      { status: 400 },
    );
  }

  if (!answer || answer.length < 12 || answer.length > 800) {
    return privateJson({ error: "Invalid answer", code: "INVALID_BODY", correlationId }, { status: 400 });
  }

  try {
    const evaluation = evaluateDepthAnswer({
      questionText: questionForMockProfile(profileId),
      answerText: answer,
    });
    const verdict: "PASS" | "REVIEW" | "REJECT" | "ERROR" = evaluation.verdict;
    const reasonCodes: string[] = evaluation.reasonCodes;

    if (verdict === "PASS") {
      await setUnlockCookie(profileId, user.id);
    }

    return privateJson({ verdict, reasonCodes, correlationId, source: "mock" });
  } catch (error) {
    void error;
    return privateJson(
      { verdict: "ERROR", reasonCodes: [], code: "EVALUATION_FAILED", correlationId },
      { status: 500 },
    );
  }
}
