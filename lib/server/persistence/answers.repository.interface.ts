import type {
  SaveOnboardingAnswerInput,
  SaveOnboardingAnswerResult,
} from "@/lib/server/persistence/answers.types";

/** Replaceable persistence boundary — routes depend on this, not on Supabase. */
export interface AnswersRepository {
  saveOnboardingAnswer(input: SaveOnboardingAnswerInput): Promise<SaveOnboardingAnswerResult>;
}
