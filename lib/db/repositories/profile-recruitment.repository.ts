import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { ALPHA_STAGE_1_PHASE } from "@/lib/alpha/stage1-policy";
import { eligibleProfileSql } from "@/lib/db/repositories/introduction-policy";

/** Founder-only snapshot addition. No email/name/phone or profile identifiers are returned. */
export async function getProfileRecruitmentCounts() {
  const result = await getDb().execute<{ gender: string; registered: number; verified: number; eligible: number }>(sql`
    WITH population AS (
      SELECT DISTINCT u.id FROM users u JOIN alpha_invites i ON i.consumed_by_user_id = u.id
      WHERE i.target_phase = ${ALPHA_STAGE_1_PHASE} AND i.status = 'consumed' AND u.invite_finalized_at IS NOT NULL
    ) SELECT coalesce(b.gender, 'not_provided') AS gender,
      count(*)::int AS registered,
      count(*) FILTER (WHERE v.status = 'verified' AND v.profile_revision = b.revision AND v.provider_purged_at IS NOT NULL)::int AS verified,
      count(*) FILTER (WHERE ${eligibleProfileSql(sql`population.id`)})::int AS eligible
    FROM population LEFT JOIN profile_basics b ON b.user_id = population.id
    LEFT JOIN identity_verifications v ON v.user_id = population.id
    GROUP BY coalesce(b.gender, 'not_provided') ORDER BY gender
  `);
  return {
    population: "stage1_consumed_invites_with_finalized_accounts",
    groups: ["male", "female", "not_provided"].map((gender) => {
      const row = result.rows.find((r) => r.gender === gender);
      return { gender, registered: Number(row?.registered ?? 0), verified: Number(row?.verified ?? 0), eligible: Number(row?.eligible ?? 0) };
    }),
    waitlistGender: "not_collected",
    roleBucketsAreGender: false,
  };
}
