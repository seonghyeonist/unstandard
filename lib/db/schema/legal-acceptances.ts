import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid, boolean } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";

/**
 * Versioned, server-timestamped evidence for the Closed Alpha registration
 * gates. This is deliberately separate from the privacy notice: it records
 * only the affirmative adult/terms/safety selections required to register.
 */
export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    adultConfirmed: boolean("adult_confirmed").notNull(),
    termsVersion: text("terms_version").notNull(),
    safetyRulesVersion: text("safety_rules_version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("legal_acceptances_user_id_idx").on(table.userId),
    uniqueIndex("legal_acceptances_user_versions_unique").on(
      table.userId,
      table.termsVersion,
      table.safetyRulesVersion,
    ),
    check("legal_acceptances_adult_confirmed_check", sql`${table.adultConfirmed} = true`),
    check(
      "legal_acceptances_terms_version_check",
      // Keep the version as a SQL literal: drizzle-kit serializes interpolated
      // strings as $1/$2, which cannot execute in a migration file.
      sql`${table.termsVersion} = 'closed-alpha-terms-v1'`,
    ),
    check(
      "legal_acceptances_safety_rules_version_check",
      sql`${table.safetyRulesVersion} = 'closed-alpha-safety-v1'`,
    ),
  ],
);
