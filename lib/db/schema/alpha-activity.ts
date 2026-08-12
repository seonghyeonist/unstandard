import { date, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";

/**
 * Privacy-minimized daily presence. No URL, IP, user-agent, message, or answer
 * content is stored here. Exact UTC day is sufficient for D7 measurement.
 */
export const alphaActivityDays = pgTable(
  "alpha_activity_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityDate: date("activity_date", { mode: "string" }).notNull(),
  },
  (table) => [
    uniqueIndex("alpha_activity_days_user_date_unique").on(table.userId, table.activityDate),
    index("alpha_activity_days_date_idx").on(table.activityDate),
  ],
);
