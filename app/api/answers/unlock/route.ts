import { getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { candidates } from "@/lib/data/mock-public";
import { evaluateDepthAnswer } from "@/lib/depth/evaluate-depth-answer";
import { privateJson } from "@/lib/http/private-json";
import { setUnlockCookie } from "@/lib/server/unlock-cookies";

function questionForProfile(profileId: string): string {
  return candidates.find((candidate) => candidate.id === profileId)?.question ?? "";
}

export async function POST(request: Request) {
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return privateJson({ error: "Service temporarily unavailable" }, { status: 503 });
    }
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }

  // The current candidate/private-profile surface is mock-backed. Do not let
  // a signed cookie masquerade as a DB-backed unlock in Preview/Production.
  if (isDatabaseRuntime()) {
    return privateJson({ error: "Database-backed unlock is not available" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return privateJson({ error: "Invalid body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const profileId = typeof input.profileId === "string"
    ? input.profileId.trim()
    : "";
  const answer = typeof input.answer === "string"
    ? input.answer.trim()
    : "";

  if (!profileId || profileId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(profileId)) {
    return privateJson({ error: "Invalid profileId" }, { status: 400 });
  }

  if (!answer || answer.length < 12 || answer.length > 800) {
    return privateJson({ error: "Invalid answer" }, { status: 400 });
  }

  try {
    // The live app scores answers with the deterministic local heuristic only
    // (mock-local-heuristic-v0.0). There is no path here that can select or
    // credential a remote Depth service — see docs/LOCAL_AI_POC_STATUS.md.
    const evaluation = evaluateDepthAnswer({
      questionText: questionForProfile(profileId),
      answerText: answer,
    });
    const verdict: "PASS" | "REVIEW" | "REJECT" | "ERROR" = evaluation.verdict;
    const reasonCodes: string[] = evaluation.reasonCodes;

    if (verdict === "PASS") {
      await setUnlockCookie(profileId, user.id);
    }

    return privateJson({ verdict, reasonCodes });
  } catch (error) {
    void error;
    return privateJson({ verdict: "ERROR", reasonCodes: [] }, { status: 500 });
  }
}
