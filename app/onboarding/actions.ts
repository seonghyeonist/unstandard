"use server";

import { completeMockOnboarding } from "@/app/login/actions";
import { AuthError, requireAuthenticatedUser } from "@/lib/auth/server";
import { isMockAuthAllowed, isSupabaseAuthEnabled } from "@/lib/config/auth-mode";
import { isAnswersPersistenceEnabled } from "@/lib/config/answers-persistence-mode";
import { onboardingQuestion } from "@/lib/data/mock-public";
import type { OnboardingResponse } from "@/lib/api/onboarding-store";
import {
  DEPTH_MOCK_MODEL_VERSION,
  evaluateDepthAnswer,
} from "@/lib/depth/evaluate-depth-answer";
import { createAnswersRepository } from "@/lib/server/persistence/answers.repository.factory";
import { validateOnboardingAnswerInput } from "@/lib/security/onboarding-validation";
import type { CurrentUser } from "@/types/user";

export type PersistOnboardingAnswerResult = {
  user: CurrentUser;
  clientStorage?: OnboardingResponse;
};

export async function persistOnboardingAnswer(input: {
  nickname: string;
  answer: string;
}): Promise<PersistOnboardingAnswerResult> {
  if (isSupabaseAuthEnabled() && isAnswersPersistenceEnabled()) {
    let user;
    try {
      user = await requireAuthenticatedUser();
    } catch (error) {
      if (error instanceof AuthError) {
        throw new Error("Unauthorized");
      }
      throw error;
    }

    const validated = validateOnboardingAnswerInput(input);
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

    if (!result.ok) {
      throw new Error("Onboarding answer persistence failed");
    }

    const idPrefix = user.id.replace(/-/g, "").slice(0, 8);
    return {
      user: {
        nickname: validated.nickname,
        onboarded: true,
        idPrefix,
      },
    };
  }

  if (!isMockAuthAllowed()) {
    throw new Error("Onboarding persistence is not configured for this environment.");
  }

  const user = await completeMockOnboarding(input.nickname);
  const evaluation = evaluateDepthAnswer({
    questionText: onboardingQuestion.prompt,
    answerText: input.answer,
  });

  return {
    user: {
      nickname: user.nickname,
      onboarded: user.onboarded,
      idPrefix: user.id.replace(/-/g, "").slice(0, 8),
    },
    clientStorage: {
      userId: user.id,
      questionId: onboardingQuestion.id,
      questionText: onboardingQuestion.prompt,
      answerText: input.answer,
      createdAt: new Date().toISOString(),
      evaluation: {
        score: evaluation.score,
        verdict: evaluation.verdict,
        path: evaluation.path,
        modelVersion: DEPTH_MOCK_MODEL_VERSION,
      },
    },
  };
}
