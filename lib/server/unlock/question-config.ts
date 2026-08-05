import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { appConfig } from "@/lib/db/schema/app-config";
import { questions } from "@/lib/db/schema/questions";
import { isUuid } from "@/lib/server/unlock/uuid";
import {
  DEFAULT_UNLOCK_QUESTION_ID,
  UNLOCK_QUESTION_CONFIG_KEY,
} from "@/lib/unlock/question-constants";

export { DEFAULT_UNLOCK_QUESTION_ID, UNLOCK_QUESTION_CONFIG_KEY };

export type UnlockQuestion = {
  id: string;
  prompt: string;
  helper: string | null;
};

export async function getConfiguredUnlockQuestion(): Promise<UnlockQuestion | null> {
  const db = getDb();
  const [configRow] = await db
    .select({ value: appConfig.value })
    .from(appConfig)
    .where(eq(appConfig.key, UNLOCK_QUESTION_CONFIG_KEY))
    .limit(1);

  const raw = configRow?.value;
  const questionId =
    raw && typeof raw === "object" && raw !== null && "questionId" in raw
      ? String((raw as { questionId: unknown }).questionId)
      : "";

  if (!isUuid(questionId)) {
    return null;
  }

  const [question] = await db
    .select({
      id: questions.id,
      prompt: questions.prompt,
      helper: questions.helper,
      active: questions.active,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question || !question.active) {
    return null;
  }

  return {
    id: question.id,
    prompt: question.prompt,
    helper: question.helper,
  };
}
