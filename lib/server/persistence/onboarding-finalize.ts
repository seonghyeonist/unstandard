/**
 * Pure onboarding finalize gate — keeps profile.onboarded_at off until persistence is complete.
 */
export type OnboardingFinalizeState = {
  existingAnswerId: string | null;
  existingEvaluationComplete: boolean;
  answerInserted: boolean;
  evaluationInserted: boolean;
};

export function canMarkProfileOnboarded(state: OnboardingFinalizeState): boolean {
  if (state.existingAnswerId) {
    return state.existingEvaluationComplete;
  }

  return state.answerInserted && state.evaluationInserted;
}
