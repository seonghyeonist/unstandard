import type {
  SaveOnboardingAnswerInput,
  SaveOnboardingAnswerResult,
} from "@/lib/server/persistence/answers.types";

/** Replaceable persistence boundary — routes depend on this interface only. */
export interface AnswersRepository {
  saveOnboardingAnswer(input: SaveOnboardingAnswerInput): Promise<SaveOnboardingAnswerResult>;
}
