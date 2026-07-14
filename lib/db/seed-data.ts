/**
 * Closed-alpha seed dataset — shared by operator CLI and integration proofs.
 * Identical input must be state-idempotent: no duplicate rows, no stable-value
 * drift, and no unnecessary updated_at bumps.
 */
import { neon } from "@neondatabase/serverless";
import { onboardingQuestion } from "@/lib/data/mock-public";

export const SEED_APP_CONFIG_KEY = "alpha.closed" as const;
export const SEED_APP_CONFIG_VALUE = { enabled: true } as const;

export async function seedClosedAlphaData(databaseUrl: string): Promise<void> {
  const sql = neon(databaseUrl);
  await seedClosedAlphaDataWithSql(sql);
}

type SeedSqlClient = {
  (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Record<string, unknown>[]>;
};

/**
 * Core seed implementation. Prefer seedClosedAlphaData(url) from operators.
 * The CLI (`scripts/db/seed.ts`) is a thin wrapper around this function.
 */
export async function seedClosedAlphaDataWithSql(sql: SeedSqlClient): Promise<void> {
  await sql`
    INSERT INTO questions (id, prompt, helper, active)
    VALUES (
      ${onboardingQuestion.id},
      ${onboardingQuestion.prompt},
      ${onboardingQuestion.helper ?? null},
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      prompt = EXCLUDED.prompt,
      helper = EXCLUDED.helper,
      active = EXCLUDED.active
    WHERE questions.prompt IS DISTINCT FROM EXCLUDED.prompt
       OR questions.helper IS DISTINCT FROM EXCLUDED.helper
       OR questions.active IS DISTINCT FROM EXCLUDED.active
  `;

  const valueJson = JSON.stringify(SEED_APP_CONFIG_VALUE);
  await sql`
    INSERT INTO app_config (key, value)
    VALUES (${SEED_APP_CONFIG_KEY}, CAST(${valueJson} AS jsonb))
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now()
    WHERE app_config.value IS DISTINCT FROM EXCLUDED.value
  `;
}

export { onboardingQuestion as seedOnboardingQuestion };
