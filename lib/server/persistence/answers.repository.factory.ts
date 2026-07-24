import "server-only";

import { isAnswersPersistenceEnabled } from "@/lib/config/answers-persistence-mode";
import type { AnswersRepository } from "@/lib/server/persistence/answers.repository.interface";
import type {
  SaveOnboardingAnswerInput,
  SaveOnboardingAnswerResult,
} from "@/lib/server/persistence/answers.types";
import { saveOnboardingAnswerFailure } from "@/lib/server/persistence/answers.types";
import { createDrizzleAnswersRepository } from "@/lib/db/repositories/answers.repository";

const persistenceDisabledRepository: AnswersRepository = {
  async saveOnboardingAnswer(): Promise<SaveOnboardingAnswerResult> {
    return saveOnboardingAnswerFailure("PERSISTENCE_DISABLED");
  },
};

export function createAnswersRepository(): AnswersRepository {
  if (!isAnswersPersistenceEnabled()) {
    return persistenceDisabledRepository;
  }
  return createDrizzleAnswersRepository();
}

export type { SaveOnboardingAnswerInput, SaveOnboardingAnswerResult };
