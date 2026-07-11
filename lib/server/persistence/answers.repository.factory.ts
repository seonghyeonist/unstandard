import "server-only";

import { isAnswersPersistenceEnabled } from "@/lib/config/answers-persistence-mode";
import type { AnswersRepository } from "@/lib/server/persistence/answers.repository.interface";
import type {
  SaveOnboardingAnswerInput,
  SaveOnboardingAnswerResult,
} from "@/lib/server/persistence/answers.types";
import { saveOnboardingAnswerFailure } from "@/lib/server/persistence/answers.types";
import { createSupabaseAnswersRepository } from "@/lib/server/persistence/adapters/supabase/answers.repository";

const persistenceDisabledRepository: AnswersRepository = {
  async saveOnboardingAnswer(): Promise<SaveOnboardingAnswerResult> {
    return saveOnboardingAnswerFailure("PERSISTENCE_DISABLED");
  },
};

/**
 * Wires the active alpha persistence adapter. Route imports this only.
 * Current wiring: Supabase alpha adapter when explicitly enabled — not production architecture.
 */
export function createAnswersRepository(): AnswersRepository {
  if (!isAnswersPersistenceEnabled()) {
    return persistenceDisabledRepository;
  }
  return createSupabaseAnswersRepository();
}

export type { SaveOnboardingAnswerInput, SaveOnboardingAnswerResult };
