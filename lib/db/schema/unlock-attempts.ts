import { sql } from "drizzle-orm";
import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";
import { profiles } from "@/lib/db/schema/profiles";
import { questions } from "@/lib/db/schema/questions";

/**
 * Per-attempt unlock evaluation audit trail.
 * Separate from `answers` so onboarding's (user_id, question_id) unique invariant stays intact.
 */
export const unlockAttempts = pgTable(
  "unlock_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    viewerUserId: text("viewer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetProfileId: uuid("target_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    answerText: text("answer_text").notNull(),
    verdict: text("verdict").notNull(),
    score: numeric("score", { precision: 6, scale: 4 }),
    path: text("path"),
    reasonCodes: text("reason_codes")
      .array()
      .default(sql`'{}'::text[]`),
    modelVersion: text("model_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("unlock_attempts_viewer_user_id_idx").on(table.viewerUserId),
    index("unlock_attempts_target_profile_id_idx").on(table.targetProfileId),
    index("unlock_attempts_viewer_target_created_idx").on(
      table.viewerUserId,
      table.targetProfileId,
      table.createdAt,
    ),
  ],
);
