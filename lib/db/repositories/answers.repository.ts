import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { answers, depthEvaluations } from "@/lib/db/schema/answers";
import { profiles } from "@/lib/db/schema/profiles";
import { canMarkProfileOnboarded } from "@/lib/server/persistence/onboarding-finalize";
import type { AnswersRepository } from "@/lib/server/persistence/answers.repository.interface";
import type { SaveOnboardingAnswerInput } from "@/lib/server/persistence/answers.types";
import {
  saveOnboardingAnswerFailure,
  saveOnboardingAnswerSuccess,
  type SaveOnboardingAnswerResult,
} from "@/lib/server/persistence/answers.types";

export function createDrizzleAnswersRepository(): AnswersRepository {
  return {
    saveOnboardingAnswer: (input) => saveOnboardingAnswer(input),
  };
}

async function getProfileIdForUser(userId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row?.id ?? null;
}

async function upsertProfileMetadata(userId: string, nickname: string): Promise<"ok" | "setup_required"> {
  const db = getDb();
  const now = new Date();
  const updated = await db
    .update(profiles)
    .set({ nickname, updatedAt: now })
    .where(eq(profiles.userId, userId))
    .returning({ id: profiles.id });

  if (updated.length > 0) {
    return "ok";
  }

  const inserted = await db
    .insert(profiles)
    .values({ userId, nickname })
    .onConflictDoNothing({ target: profiles.userId })
    .returning({ id: profiles.id });

  if (inserted.length > 0) {
    return "ok";
  }

  const reconciled = await getProfileIdForUser(userId);
  return reconciled ? "ok" : "setup_required";
}

async function findExistingOnboardingAnswer(
  userId: string,
  questionId: string,
): Promise<{ id: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: answers.id })
    .from(answers)
    .where(and(eq(answers.userId, userId), eq(answers.questionId, questionId)))
    .limit(1);
  return row ?? null;
}

async function hasDepthEvaluation(answerId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: depthEvaluations.id })
    .from(depthEvaluations)
    .where(eq(depthEvaluations.answerId, answerId))
    .limit(1);
  return Boolean(row);
}

async function insertDepthEvaluation(
  input: SaveOnboardingAnswerInput,
  answerId: string,
): Promise<"ok" | "db_error"> {
  const db = getDb();
  try {
    await db.insert(depthEvaluations).values({
      answerId,
      userId: input.userId,
      verdict: input.evaluation.verdict,
      score: String(input.evaluation.score),
      path: input.evaluation.path,
      reasonCodes: input.evaluation.reasonCodes,
      modelVersion: input.evaluation.modelVersion,
    });
    return "ok";
  } catch {
    return "db_error";
  }
}

async function markProfileOnboarded(userId: string, nickname: string): Promise<"ok" | "setup_required"> {
  const db = getDb();
  const now = new Date();
  const updated = await db
    .update(profiles)
    .set({ nickname, onboardedAt: now, updatedAt: now })
    .where(eq(profiles.userId, userId))
    .returning({ id: profiles.id });
  return updated.length > 0 ? "ok" : "setup_required";
}

async function finalizeOnboardingProfile(
  input: SaveOnboardingAnswerInput,
  state: {
    existingAnswerId: string | null;
    existingEvaluationComplete: boolean;
    answerInserted: boolean;
    evaluationInserted: boolean;
  },
): Promise<"ok" | "setup_required"> {
  if (!canMarkProfileOnboarded(state)) {
    return "setup_required";
  }
  return markProfileOnboarded(input.userId, input.nickname);
}

async function completeExistingOnboardingAnswer(
  input: SaveOnboardingAnswerInput,
  answerId: string,
): Promise<SaveOnboardingAnswerResult> {
  const metadataResult = await upsertProfileMetadata(input.userId, input.nickname);
  if (metadataResult !== "ok") {
    return saveOnboardingAnswerFailure("SETUP_REQUIRED");
  }

  let evaluationComplete = await hasDepthEvaluation(answerId);
  if (!evaluationComplete) {
    const evaluationResult = await insertDepthEvaluation(input, answerId);
    if (evaluationResult !== "ok") {
      return saveOnboardingAnswerFailure("DB_ERROR");
    }
    evaluationComplete = true;
  }

  const finalizeResult = await finalizeOnboardingProfile(input, {
    existingAnswerId: answerId,
    existingEvaluationComplete: evaluationComplete,
    answerInserted: false,
    evaluationInserted: false,
  });

  if (finalizeResult !== "ok") {
    return saveOnboardingAnswerFailure("SETUP_REQUIRED");
  }

  return saveOnboardingAnswerSuccess(answerId, true);
}

async function saveOnboardingAnswer(input: SaveOnboardingAnswerInput): Promise<SaveOnboardingAnswerResult> {
  try {
    const existing = await findExistingOnboardingAnswer(input.userId, input.questionId);
    if (existing) {
      return completeExistingOnboardingAnswer(input, existing.id);
    }

    const metadataResult = await upsertProfileMetadata(input.userId, input.nickname);
    if (metadataResult !== "ok") {
      return saveOnboardingAnswerFailure("SETUP_REQUIRED");
    }

    const profileId = await getProfileIdForUser(input.userId);
    if (!profileId) {
      return saveOnboardingAnswerFailure("SETUP_REQUIRED");
    }

    const db = getDb();
    try {
      const [answerRow] = await db
        .insert(answers)
        .values({
          userId: input.userId,
          questionId: input.questionId,
          targetProfileId: profileId,
          answerText: input.answerText,
        })
        .returning({ id: answers.id });

      if (!answerRow) {
        return saveOnboardingAnswerFailure("DB_ERROR");
      }

      const evaluationResult = await insertDepthEvaluation(input, answerRow.id);
      if (evaluationResult !== "ok") {
        return saveOnboardingAnswerFailure("DB_ERROR");
      }

      const finalizeResult = await finalizeOnboardingProfile(input, {
        existingAnswerId: null,
        existingEvaluationComplete: false,
        answerInserted: true,
        evaluationInserted: true,
      });

      if (finalizeResult !== "ok") {
        return saveOnboardingAnswerFailure("SETUP_REQUIRED");
      }

      return saveOnboardingAnswerSuccess(answerRow.id, false);
    } catch (error: unknown) {
      const pgCode = (error as { code?: string })?.code;
      if (pgCode === "23505") {
        const duplicate = await findExistingOnboardingAnswer(input.userId, input.questionId);
        if (duplicate) {
          return completeExistingOnboardingAnswer(input, duplicate.id);
        }
      }
      if (pgCode === "23503") {
        return saveOnboardingAnswerFailure("SETUP_REQUIRED");
      }
      return saveOnboardingAnswerFailure("DB_ERROR");
    }
  } catch {
    return saveOnboardingAnswerFailure("DB_ERROR");
  }
}
