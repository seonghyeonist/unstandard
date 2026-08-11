import { AuthError, requireAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { isDatabaseAuthConfigured } from "@/lib/config/runtime-mode";
import { onboardingQuestion } from "@/lib/data/mock-public";
import {
  DEPTH_MOCK_MODEL_VERSION,
  evaluateDepthAnswer,
} from "@/lib/depth/evaluate-depth-answer";
import { mapSaveOnboardingAnswerResultToHttp } from "@/lib/server/persistence/answers.http-mapper";
import { createAnswersRepository } from "@/lib/server/persistence/answers.repository.factory";
import { validateOnboardingAnswerInput } from "@/lib/security/onboarding-validation";
import { privateJson } from "@/lib/http/private-json";
import { consumeRateLimit, RateLimitUnavailableError } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (!isDatabaseAuthConfigured()) {
    return privateJson({ error: "Database auth required" }, { status: 403 });
  }

  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthError) {
      return privateJson({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ServiceUnavailableError) {
      return privateJson({ error: "Service temporarily unavailable" }, { status: 503 });
    }
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decision = await consumeRateLimit({ scope: "onboardingAnswer", subject: user.id });
    if (!decision.allowed) {
      return privateJson(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
      );
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return privateJson({ error: "Service temporarily unavailable" }, { status: 503 });
    }
    throw error;
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

  let validated;
  try {
    validated = validateOnboardingAnswerInput({
      nickname: input.nickname,
      answer: input.answer,
    });
  } catch (error) {
    void error;
    return privateJson({ error: "Invalid input" }, { status: 400 });
  }

  const evaluation = evaluateDepthAnswer({
    questionText: onboardingQuestion.prompt,
    answerText: validated.answer,
  });

  const repository = createAnswersRepository();
  const result = await repository.saveOnboardingAnswer({
    userId: user.id,
    nickname: validated.nickname,
    questionId: onboardingQuestion.id,
    answerText: validated.answer,
    evaluation: {
      verdict: evaluation.verdict,
      score: evaluation.score,
      path: evaluation.path,
      modelVersion: DEPTH_MOCK_MODEL_VERSION,
      reasonCodes: evaluation.reasonCodes,
    },
  });

  const mapped = mapSaveOnboardingAnswerResultToHttp(result);
  return privateJson(mapped.body, { status: mapped.status });
}
