/**
 * Closed-alpha seed dataset — shared by operator CLI and integration proofs.
 *
 * Mutation outcomes are observed via INSERT ... ON CONFLICT ... DO UPDATE
 * ... WHERE ... RETURNING (affected row count), not timestamp inference alone.
 */
import { neon } from "@neondatabase/serverless";
import { onboardingQuestion } from "@/lib/data/mock-public";
import {
  DEFAULT_UNLOCK_QUESTION_ID,
  UNLOCK_QUESTION_CONFIG_KEY,
} from "@/lib/unlock/question-constants";

export const SEED_APP_CONFIG_KEY = "alpha.closed" as const;
export const SEED_APP_CONFIG_VALUE = { enabled: true } as const;

export const DEFAULT_UNLOCK_QUESTION = {
  id: DEFAULT_UNLOCK_QUESTION_ID,
  prompt: "최근에 마음이 느슨해졌던 순간은 언제였나요?",
  helper: "정답은 없어요. 장면 하나만 구체적으로 적어주세요.",
  active: true,
} as const;

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
  unlockQuestion: SeedQuestion;
  appConfig: SeedAppConfig;
  unlockQuestionConfig: SeedAppConfig;
};

export type SeedMutationOutcome = {
  questionChanged: boolean;
  unlockQuestionChanged: boolean;
  appConfigChanged: boolean;
  unlockQuestionConfigChanged: boolean;
  profilePrivateTouched: number;
  profilePublicTouched: number;
};

export const DEFAULT_CLOSED_ALPHA_SEED: SeedDataset = {
  question: {
    id: onboardingQuestion.id,
    prompt: onboardingQuestion.prompt,
    helper: onboardingQuestion.helper ?? null,
    active: true,
  },
  unlockQuestion: {
    id: DEFAULT_UNLOCK_QUESTION.id,
    prompt: DEFAULT_UNLOCK_QUESTION.prompt,
    helper: DEFAULT_UNLOCK_QUESTION.helper,
    active: DEFAULT_UNLOCK_QUESTION.active,
  },
  appConfig: {
    key: SEED_APP_CONFIG_KEY,
    value: { ...SEED_APP_CONFIG_VALUE },
  },
  unlockQuestionConfig: {
    key: UNLOCK_QUESTION_CONFIG_KEY,
    value: { questionId: DEFAULT_UNLOCK_QUESTION_ID },
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

async function upsertQuestion(
  sql: SeedSqlClient,
  question: SeedQuestion,
): Promise<boolean> {
  const rows = await sql`
    INSERT INTO questions (id, prompt, helper, active)
    VALUES (
      ${question.id},
      ${question.prompt},
      ${question.helper},
      ${question.active}
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
  return rows.length > 0;
}

async function upsertAppConfig(
  sql: SeedSqlClient,
  config: SeedAppConfig,
): Promise<boolean> {
  const valueJson = JSON.stringify(config.value);
  const rows = await sql`
    INSERT INTO app_config (key, value)
    VALUES (${config.key}, CAST(${valueJson} AS jsonb))
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now()
    WHERE app_config.value IS DISTINCT FROM EXCLUDED.value
    RETURNING key
  `;
  return rows.length > 0;
}

/**
 * Idempotent public/private enrichment for onboarded profiles.
 * Does not create/delete users or change passwords/sessions.
 */
async function enrichOnboardedProfiles(sql: SeedSqlClient): Promise<{
  profilePrivateTouched: number;
  profilePublicTouched: number;
}> {
  const publicRows = await sql`
    UPDATE profiles
    SET
      city = COALESCE(NULLIF(city, ''), '서울'),
      teaser = COALESCE(NULLIF(teaser, ''), '작은 장면을 잘 기억하는 편이에요.'),
      updated_at = now()
    WHERE onboarded_at IS NOT NULL
      AND (
        city IS NULL OR city = '' OR
        teaser IS NULL OR teaser = ''
      )
    RETURNING id
  `;

  const privateRows = await sql`
    INSERT INTO profile_private (profile_id, letter, small_joys, soft_facts, blurred_note)
    SELECT
      p.id,
      '아직 짧게만 남겨둔 편지예요. 천천히 읽어도 괜찮아요.',
      ARRAY['따뜻한 국물', '늦은 산책'],
      ARRAY['답장을 천천히 다정하게 하는 편', '주말 오전 산책을 좋아함'],
      '이 사람의 취향과 첫 메시지 힌트가 아직 가려져 있어요.'
    FROM profiles p
    WHERE p.onboarded_at IS NOT NULL
    ON CONFLICT (profile_id) DO UPDATE SET
      letter = COALESCE(NULLIF(profile_private.letter, ''), EXCLUDED.letter),
      small_joys = CASE
        WHEN profile_private.small_joys IS NULL OR cardinality(profile_private.small_joys) = 0
          THEN EXCLUDED.small_joys
        ELSE profile_private.small_joys
      END,
      soft_facts = CASE
        WHEN profile_private.soft_facts IS NULL OR cardinality(profile_private.soft_facts) = 0
          THEN EXCLUDED.soft_facts
        ELSE profile_private.soft_facts
      END,
      blurred_note = COALESCE(NULLIF(profile_private.blurred_note, ''), EXCLUDED.blurred_note),
      updated_at = now()
    WHERE profile_private.letter IS DISTINCT FROM COALESCE(NULLIF(profile_private.letter, ''), EXCLUDED.letter)
       OR profile_private.small_joys IS DISTINCT FROM CASE
            WHEN profile_private.small_joys IS NULL OR cardinality(profile_private.small_joys) = 0
              THEN EXCLUDED.small_joys
            ELSE profile_private.small_joys
          END
    RETURNING profile_id
  `;

  return {
    profilePublicTouched: publicRows.length,
    profilePrivateTouched: privateRows.length,
  };
}

/**
 * Core seed implementation. Prefer seedClosedAlphaData(url) from operators.
 * The CLI (`scripts/db/seed.ts`) is a thin wrapper around the default dataset.
 */
export async function seedClosedAlphaDataWithSql(
  sql: SeedSqlClient,
  dataset: SeedDataset = DEFAULT_CLOSED_ALPHA_SEED,
): Promise<SeedMutationOutcome> {
  const questionChanged = await upsertQuestion(sql, dataset.question);
  const unlockQuestionChanged = await upsertQuestion(sql, dataset.unlockQuestion);
  const appConfigChanged = await upsertAppConfig(sql, dataset.appConfig);
  const unlockQuestionConfigChanged = await upsertAppConfig(sql, dataset.unlockQuestionConfig);
  const enriched = await enrichOnboardedProfiles(sql);

  return {
    questionChanged,
    unlockQuestionChanged,
    appConfigChanged,
    unlockQuestionConfigChanged,
    profilePrivateTouched: enriched.profilePrivateTouched,
    profilePublicTouched: enriched.profilePublicTouched,
  };
}

export { onboardingQuestion as seedOnboardingQuestion };
