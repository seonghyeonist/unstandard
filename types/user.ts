export type CurrentUser = {
  id: string;
  nickname: string;
  onboarded: boolean;
};

export type OnboardingQuestion = {
  id: string;
  prompt: string;
  helper: string;
};
