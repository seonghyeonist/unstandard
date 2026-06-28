export type CurrentUser = {
  id: string;
  nickname: string;
  onboarded: boolean;
  /** Safe display prefix — not the full auth user id when omitted server-side */
  idPrefix?: string;
};

export type OnboardingQuestion = {
  id: string;
  prompt: string;
  helper: string;
};
