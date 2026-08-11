import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";
import { profiles } from "@/lib/db/schema/profiles";

export const unlocks = pgTable(
  "unlocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    viewerUserId: text("viewer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unlocks_viewer_profile_unique").on(table.viewerUserId, table.profileId),
    index("unlocks_viewer_user_id_idx").on(table.viewerUserId),
    index("unlocks_profile_id_idx").on(table.profileId),
  ],
);
