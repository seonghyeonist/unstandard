import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";

export const alphaInvites = pgTable(
  "alpha_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailNormalized: text("email_normalized").notNull(),
    codeHash: text("code_hash").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByUserId: text("consumed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("alpha_invites_code_hash_unique").on(table.codeHash),
    index("alpha_invites_email_idx").on(table.emailNormalized),
  ],
);
