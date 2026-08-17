import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

/** Records a unique question exposure without copying profile or question text. */
export async function recordProfileExposure(
  viewerUserId: string,
  targetProfileId: string,
): Promise<void> {
  await getDb().execute(sql`
    INSERT INTO alpha_profile_exposures (
      viewer_user_id,
      target_profile_id
    )
    SELECT ${viewerUserId}, p.id
    FROM profiles AS p
    WHERE p.id = ${targetProfileId}::uuid
      AND p.user_id <> ${viewerUserId}
      AND p.onboarded_at IS NOT NULL
    ON CONFLICT (viewer_user_id, target_profile_id) DO NOTHING
  `);
}
