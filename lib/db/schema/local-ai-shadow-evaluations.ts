import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { unlockAttempts } from "@/lib/db/schema/unlock-attempts";

/** Sanitized observer output for a canonical unlock attempt. Never stores Q/A or embeddings. */
export const localAiShadowEvaluations = pgTable(
  "local_ai_shadow_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unlockAttemptId: uuid("unlock_attempt_id")
      .notNull()
      .references(() => unlockAttempts.id, { onDelete: "cascade" }),
    depthScore: numeric("depth_score", { precision: 6, scale: 4 }).notNull(),
    verdict: text("verdict").notNull(),
    path: text("path").notNull(),
    reasonCodes: text("reason_codes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    personalGroundingScore: numeric("personal_grounding_score", { precision: 6, scale: 4 }),
    ungroundedAbstractPenalty: numeric("ungrounded_abstract_penalty", { precision: 6, scale: 4 }),
    abstractStyleHits: integer("abstract_style_hits"),
    relevanceScore: numeric("relevance_score", { precision: 6, scale: 4 }),
    specificityScore: numeric("specificity_score", { precision: 6, scale: 4 }),
    repeatPatternPenalty: numeric("repeat_pattern_penalty", { precision: 6, scale: 4 }),
    emojiSymbolPenalty: numeric("emoji_symbol_penalty", { precision: 6, scale: 4 }),
    spamSignaturePenalty: numeric("spam_signature_penalty", { precision: 6, scale: 4 }),
    modelVersion: text("model_version").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("local_ai_shadow_attempt_model_unique").on(table.unlockAttemptId, table.modelVersion),
    index("local_ai_shadow_created_at_idx").on(table.createdAt),
    check(
      "local_ai_shadow_score_range",
      sql`${table.depthScore} >= 0 AND ${table.depthScore} <= 1`,
    ),
    check(
      "local_ai_shadow_verdict_allowed",
      sql`${table.verdict} IN ('PASS', 'REVIEW', 'REJECT')`,
    ),
    check("local_ai_shadow_path_nonempty", sql`char_length(${table.path}) BETWEEN 1 AND 48`),
    check("local_ai_shadow_reason_codes_bounded", sql`cardinality(${table.reasonCodes}) <= 32`),
    check("local_ai_shadow_model_version_bounded", sql`char_length(${table.modelVersion}) BETWEEN 1 AND 160`),
    check("local_ai_shadow_latency_nonnegative", sql`${table.latencyMs} >= 0`),
    check(
      "local_ai_shadow_feature_ranges",
      sql`(
        (${table.personalGroundingScore} IS NULL OR ${table.personalGroundingScore} BETWEEN 0 AND 1)
        AND (${table.ungroundedAbstractPenalty} IS NULL OR ${table.ungroundedAbstractPenalty} BETWEEN 0 AND 1)
        AND (${table.abstractStyleHits} IS NULL OR ${table.abstractStyleHits} BETWEEN 0 AND 64)
        AND (${table.relevanceScore} IS NULL OR ${table.relevanceScore} BETWEEN 0 AND 1)
        AND (${table.specificityScore} IS NULL OR ${table.specificityScore} BETWEEN 0 AND 1)
        AND (${table.repeatPatternPenalty} IS NULL OR ${table.repeatPatternPenalty} BETWEEN 0 AND 1)
        AND (${table.emojiSymbolPenalty} IS NULL OR ${table.emojiSymbolPenalty} BETWEEN 0 AND 1)
        AND (${table.spamSignaturePenalty} IS NULL OR ${table.spamSignaturePenalty} BETWEEN 0 AND 1)
      )`,
    ),
  ],
);
