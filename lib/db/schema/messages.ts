import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("messages_sender_recipient_created_idx").on(
      table.senderUserId,
      table.recipientUserId,
      table.createdAt,
    ),
    index("messages_recipient_sender_created_idx").on(
      table.recipientUserId,
      table.senderUserId,
      table.createdAt,
    ),
    check("messages_distinct_users_check", sql`${table.senderUserId} <> ${table.recipientUserId}`),
    check(
      "messages_body_length_check",
      sql`char_length(${table.body}) BETWEEN 1 AND 500`,
    ),
  ],
);
