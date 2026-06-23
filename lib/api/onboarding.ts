import { completeMockOnboarding } from "@/app/login/actions";
import { markOnboarded } from "@/lib/api/auth";
import { onboardingQuestion } from "@/lib/api/mock-data";
import { saveOnboardingResponse } from "@/lib/api/onboarding-store";
import {
  DEPTH_MOCK_MODEL_VERSION,
  evaluateDepthAnswer,
} from "@/lib/depth/evaluate-depth-answer";
import type { OnboardingQuestion } from "@/types/user";

export async function getOnboardingQuestion(): Promise<OnboardingQuestion> {
  return onboardingQuestion;
}

export async function submitOnboardingAnswer(input: { nickname: string; answer: string }) {
  await completeMockOnboarding(input.nickname);
  const user = await markOnboarded(input.nickname);

  const evaluation = evaluateDepthAnswer({
    questionText: onboardingQuestion.prompt,
    answerText: input.answer,
  });

  saveOnboardingResponse({
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
  });

  return user;
}
