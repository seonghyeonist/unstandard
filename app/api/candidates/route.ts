import { getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { candidates as mockCandidates } from "@/lib/data/mock-public";
import { listPublicCandidatesForViewer } from "@/lib/db/repositories/candidates.repository";
import { privateJson } from "@/lib/http/private-json";
import {
  createCorrelationId,
  idPrefix,
  logUnlockEvent,
} from "@/lib/server/unlock/unlock-logger";

export async function GET() {
  const correlationId = createCorrelationId();

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
    return privateJson({ candidates: mockCandidates, source: "mock" });
  }

  try {
    const rows = await listPublicCandidatesForViewer(user.id);
    if (rows === "question_missing") {
      logUnlockEvent({
        event: "candidates.question_missing",
        correlationId,
        stage: "CANDIDATE_LIST",
        status: "error",
        code: "QUESTION_NOT_CONFIGURED",
        viewerUserIdPrefix: idPrefix(user.id),
      });
      return privateJson(
        {
          error: "Unlock question is not configured",
          code: "QUESTION_NOT_CONFIGURED",
          correlationId,
        },
        { status: 409 },
      );
    }

    logUnlockEvent({
      event: "candidates.ok",
      correlationId,
      stage: "CANDIDATE_LIST",
      status: "ok",
      viewerUserIdPrefix: idPrefix(user.id),
    });

    return privateJson({
      candidates: rows.map((row) => ({
        id: row.id,
        nickname: row.nickname,
        city: row.city,
        teaser: row.teaser,
        question: row.question,
      })),
      source: "database",
      correlationId,
    });
  } catch (error) {
    void error;
    return privateJson(
      {
        error: "Candidates unavailable",
        code: "UNLOCK_SERVICE_UNAVAILABLE",
        correlationId,
      },
      { status: 503 },
    );
  }
}
