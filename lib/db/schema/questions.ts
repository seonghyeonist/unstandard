import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  prompt: text("prompt").notNull(),
  helper: text("helper"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
