import { persistOnboardingAnswer } from "@/app/onboarding/actions";
import { onboardingQuestion } from "@/lib/api/mock-data";
import { saveOnboardingResponse } from "@/lib/api/onboarding-store";
import type { OnboardingQuestion } from "@/types/user";

export async function getOnboardingQuestion(): Promise<OnboardingQuestion> {
  return onboardingQuestion;
}

export async function submitOnboardingAnswer(input: { nickname: string; answer: string }) {
  const result = await persistOnboardingAnswer(input);
  if (result.clientStorage) {
    saveOnboardingResponse(result.clientStorage);
  }
  return result.user;
}
