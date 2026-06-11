import { markOnboarded } from "@/lib/api/auth";
import { onboardingQuestion } from "@/lib/api/mock-data";
import type { OnboardingQuestion } from "@/types/user";

export async function getOnboardingQuestion(): Promise<OnboardingQuestion> {
  return onboardingQuestion;
}

export async function submitOnboardingAnswer(input: { nickname: string; answer: string }) {
  void input.answer;
  return markOnboarded(input.nickname);
}
