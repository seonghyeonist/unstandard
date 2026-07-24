/**
 * Closed-alpha seed dataset — shared by operator CLI and integration proofs.
 *
 * Mutation outcomes are observed via INSERT ... ON CONFLICT ... DO UPDATE
 * ... WHERE ... RETURNING (affected row count), not timestamp inference alone.
 */
import { neon } from "@neondatabase/serverless";
import { onboardingQuestion } from "@/lib/data/mock-public";

export const SEED_APP_CONFIG_KEY = "alpha.closed" as const;
export const SEED_APP_CONFIG_VALUE = { enabled: true } as const;

export type SeedQuestion = {
  id: string;
  prompt: string;
  helper: string | null;
  active: boolean;
};

export type SeedAppConfig = {
  key: string;
  value: Record<string, unknown>;
};

export type SeedDataset = {
  question: SeedQuestion;
  appConfig: SeedAppConfig;
};

export type SeedMutationOutcome = {
  questionChanged: boolean;
  appConfigChanged: boolean;
};

export const DEFAULT_CLOSED_ALPHA_SEED: SeedDataset = {
  question: {
    id: onboardingQuestion.id,
    prompt: onboardingQuestion.prompt,
    helper: onboardingQuestion.helper ?? null,
    active: true,
  },
  appConfig: {
    key: SEED_APP_CONFIG_KEY,
    value: { ...SEED_APP_CONFIG_VALUE },
  },
};

export async function seedClosedAlphaData(
  databaseUrl: string,
  dataset: SeedDataset = DEFAULT_CLOSED_ALPHA_SEED,
): Promise<SeedMutationOutcome> {
  const sql = neon(databaseUrl);
  return seedClosedAlphaDataWithSql(sql, dataset);
}

type SeedSqlClient = {
  (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Record<string, unknown>[]>;
};

/**
 * Core seed implementation. Prefer seedClosedAlphaData(url) from operators.
 * The CLI (`scripts/db/seed.ts`) is a thin wrapper around the default dataset.
 */
export async function seedClosedAlphaDataWithSql(
  sql: SeedSqlClient,
  dataset: SeedDataset = DEFAULT_CLOSED_ALPHA_SEED,
): Promise<SeedMutationOutcome> {
  const questionRows = await sql`
    INSERT INTO questions (id, prompt, helper, active)
    VALUES (
      ${dataset.question.id},
      ${dataset.question.prompt},
      ${dataset.question.helper},
      ${dataset.question.active}
    )
    ON CONFLICT (id) DO UPDATE SET
      prompt = EXCLUDED.prompt,
      helper = EXCLUDED.helper,
      active = EXCLUDED.active
    WHERE questions.prompt IS DISTINCT FROM EXCLUDED.prompt
       OR questions.helper IS DISTINCT FROM EXCLUDED.helper
       OR questions.active IS DISTINCT FROM EXCLUDED.active
    RETURNING id
  `;

  const valueJson = JSON.stringify(dataset.appConfig.value);
  const configRows = await sql`
    INSERT INTO app_config (key, value)
    VALUES (${dataset.appConfig.key}, CAST(${valueJson} AS jsonb))
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now()
    WHERE app_config.value IS DISTINCT FROM EXCLUDED.value
    RETURNING key
  `;

  return {
    questionChanged: questionRows.length > 0,
    appConfigChanged: configRows.length > 0,
  };
}

export { onboardingQuestion as seedOnboardingQuestion };
