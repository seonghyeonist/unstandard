export type ValidatedOnboardingAnswerInput = {
  nickname: string;
  answer: string;
};

export function validateOnboardingAnswerInput(input: {
  nickname: unknown;
  answer: unknown;
}): ValidatedOnboardingAnswerInput {
  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : "";
  const answer = typeof input.answer === "string" ? input.answer.trim() : "";

  if (!nickname || nickname.length > 16) {
    throw new Error("Invalid nickname");
  }
  if (!answer || answer.length < 20 || answer.length > 600) {
    throw new Error("Invalid answer");
  }

  return { nickname, answer };
}
