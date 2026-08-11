export type OnboardingAnswerEvaluation = {
  verdict: "PASS" | "REVIEW" | "REJECT";
  score: number;
  path: string;
  modelVersion: string;
  reasonCodes: string[];
};

export type SaveOnboardingAnswerInput = {
  userId: string;
  nickname: string;
  questionId: string;
  answerText: string;
  evaluation: OnboardingAnswerEvaluation;
};

export type SaveOnboardingAnswerSuccess = {
  ok: true;
  answerId: string;
  duplicate: boolean;
};

export type SaveOnboardingAnswerFailureCode =
  | "PERSISTENCE_DISABLED"
  | "SETUP_REQUIRED"
  | "DB_ERROR"
  | "INVALID_INPUT";

export type SaveOnboardingAnswerFailure = {
  ok: false;
  code: SaveOnboardingAnswerFailureCode;
};

export type SaveOnboardingAnswerResult = SaveOnboardingAnswerSuccess | SaveOnboardingAnswerFailure;

export function saveOnboardingAnswerSuccess(
  answerId: string,
  duplicate: boolean,
): SaveOnboardingAnswerSuccess {
  return { ok: true, answerId, duplicate };
}

export function saveOnboardingAnswerFailure(
  code: SaveOnboardingAnswerFailureCode,
): SaveOnboardingAnswerFailure {
  return { ok: false, code };
}
