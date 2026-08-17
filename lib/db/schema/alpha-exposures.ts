import {
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";
import { profiles } from "@/lib/db/schema/profiles";

/** Unique viewer/target question exposure; contains no answer or profile text. */
export const alphaProfileExposures = pgTable(
  "alpha_profile_exposures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    viewerUserId: text("viewer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetProfileId: uuid("target_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("alpha_profile_exposures_viewer_target_unique").on(
      table.viewerUserId,
      table.targetProfileId,
    ),
    index("alpha_profile_exposures_target_idx").on(table.targetProfileId),
  ],
);
