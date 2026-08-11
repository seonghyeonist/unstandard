import { sql } from "drizzle-orm";
import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";
import { profiles } from "@/lib/db/schema/profiles";
import { questions } from "@/lib/db/schema/questions";

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    targetProfileId: uuid("target_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    answerText: text("answer_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("answers_user_question_unique").on(table.userId, table.questionId),
    index("answers_user_id_idx").on(table.userId),
    index("answers_target_profile_id_idx").on(table.targetProfileId),
  ],
);

export const depthEvaluations = pgTable(
  "depth_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    answerId: uuid("answer_id")
      .notNull()
      .references(() => answers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
    uniqueIndex("depth_evaluations_answer_unique").on(table.answerId),
    index("depth_evaluations_user_id_idx").on(table.userId),
  ],
);
