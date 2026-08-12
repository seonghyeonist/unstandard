import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailNormalized: text("email_normalized").notNull(),
    acquisitionChannel: text("acquisition_channel").notNull().default("organic"),
    accessTokenHash: text("access_token_hash").notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("waitlist_entries_email_unique").on(table.emailNormalized),
    uniqueIndex("waitlist_entries_token_hash_unique").on(table.accessTokenHash),
    index("waitlist_entries_channel_created_idx").on(table.acquisitionChannel, table.createdAt),
    check(
      "waitlist_entries_acquisition_channel_check",
      sql`${table.acquisitionChannel} IN ('founder_direct', 'referral', 'writing_community', 'subculture_community', 'dating_fatigue_community', 'quiet_introvert_community', 'organic', 'other_declared')`,
    ),
  ],
);

export const waitlistVisitDays = pgTable(
  "waitlist_visit_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waitlistEntryId: uuid("waitlist_entry_id")
      .notNull()
      .references(() => waitlistEntries.id, { onDelete: "cascade" }),
    visitDate: date("visit_date", { mode: "string" }).notNull(),
  },
  (table) => [
    uniqueIndex("waitlist_visit_days_entry_date_unique").on(
      table.waitlistEntryId,
      table.visitDate,
    ),
    index("waitlist_visit_days_date_idx").on(table.visitDate),
  ],
);
