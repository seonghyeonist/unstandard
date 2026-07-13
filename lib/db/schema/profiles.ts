import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    city: text("city"),
    teaser: text("teaser"),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("profiles_user_id_unique").on(table.userId),
    index("profiles_user_id_idx").on(table.userId),
  ],
);

export const profilePrivate = pgTable("profile_private", {
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  letter: text("letter"),
  smallJoys: text("small_joys")
    .array()
    .default(sql`'{}'::text[]`),
  softFacts: text("soft_facts")
    .array()
    .default(sql`'{}'::text[]`),
  blurredNote: text("blurred_note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
