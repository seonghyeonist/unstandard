import { NextResponse } from "next/server";
import { AuthError, requireAuthenticatedUser } from "@/lib/auth/server";
import { isSupabaseAuthEnabled } from "@/lib/config/auth-mode";
import { onboardingQuestion } from "@/lib/data/mock-public";
import {
  DEPTH_MOCK_MODEL_VERSION,
  evaluateDepthAnswer,
} from "@/lib/depth/evaluate-depth-answer";
import { mapSaveOnboardingAnswerResultToHttp } from "@/lib/server/persistence/answers.http-mapper";
import { createAnswersRepository } from "@/lib/server/persistence/answers.repository.factory";
import { validateOnboardingAnswerInput } from "@/lib/security/onboarding-validation";

export async function POST(request: Request) {
  if (!isSupabaseAuthEnabled()) {
    return NextResponse.json({ error: "Supabase auth required" }, { status: 403 });
  }

  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  let validated;
  try {
    validated = validateOnboardingAnswerInput({
      nickname: input.nickname,
      answer: input.answer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
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
  return NextResponse.json(mapped.body, { status: mapped.status });
}
