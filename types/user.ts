export type CurrentUser = {
  nickname: string;
  onboarded: boolean;
  /** Safe display prefix only — full auth user id is never exposed to the client session API */
  idPrefix: string;
};

export type OnboardingQuestion = {
  id: string;
  prompt: string;
  helper: string;
};
