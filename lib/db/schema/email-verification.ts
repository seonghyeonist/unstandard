import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";
import { alphaInvites } from "@/lib/db/schema/invites";

/**
 * Pre-account email ownership challenges for the closed-alpha invite flow.
 * This is intentionally separate from Better Auth's `verifications` table:
 * Better Auth creates a user before its built-in email verification, while
 * this table must prove email ownership before any user/account row exists.
 */
export const alphaEmailVerifications = pgTable(
  "alpha_email_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => alphaInvites.id, { onDelete: "cascade" }),
    emailNormalized: text("email_normalized").notNull(),
    codeHash: text("code_hash").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByUserId: text("consumed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("alpha_email_verifications_invite_idx").on(table.inviteId, table.createdAt),
    index("alpha_email_verifications_expiry_idx").on(table.expiresAt),
    check(
      "alpha_email_verifications_attempt_count_check",
      sql`${table.attemptCount} >= 0 AND ${table.attemptCount} <= 5`,
    ),
  ],
);
