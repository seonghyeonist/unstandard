import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";

export const supportRequests = pgTable(
  "support_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("OPEN"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("support_requests_user_id_idx").on(table.userId),
    index("support_requests_status_created_at_idx").on(table.status, table.createdAt),
    check(
      "support_requests_category_check",
      sql`${table.category} IN ('technical', 'safety', 'privacy', 'account', 'other')`,
    ),
    check(
      "support_requests_status_check",
      sql`${table.status} IN ('OPEN', 'IN_PROGRESS', 'CLOSED')`,
    ),
  ],
);
