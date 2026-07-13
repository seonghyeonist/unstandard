import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerUserId: text("blocker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: text("blocked_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("blocks_pair_unique").on(table.blockerUserId, table.blockedUserId),
    index("blocks_blocker_user_id_idx").on(table.blockerUserId),
    index("blocks_blocked_user_id_idx").on(table.blockedUserId),
  ],
);
