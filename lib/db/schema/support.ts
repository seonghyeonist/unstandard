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
    assignedTo: text("assigned_to"),
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

export const supportEvents = pgTable(
  "support_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id").notNull().references(() => supportRequests.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    status: text("status").notNull(),
    assignedTo: text("assigned_to").notNull(),
    response: text("response"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("support_events_ticket_created_idx").on(table.ticketId, table.createdAt),
    check("support_events_status_check", sql`${table.status} IN ('OPEN', 'IN_PROGRESS', 'CLOSED')`),
    check("support_events_response_check", sql`${table.response} IS NULL OR char_length(${table.response}) BETWEEN 10 AND 2000`),
  ],
);
