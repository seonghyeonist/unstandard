import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { DbExecutor } from "@/lib/db/types";
import { IDENTITY_NOTICE_VERSION } from "@/lib/identity/contracts";
import { PROFILE_CONSENT_VERSION, INTRODUCTION_SCOPE_VERSION } from "@/lib/profile/basics";

/** Aliases are static identifiers only. One SQL snapshot covers both profiles and attestations. */
export function eligibleProfileSql(userId: SQL): SQL {
  return sql`EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = ${userId} AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = ${PROFILE_CONSENT_VERSION}
      AND pb.introduction_scope_version = ${INTRODUCTION_SCOPE_VERSION}
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = ${IDENTITY_NOTICE_VERSION} AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )`;
}
export function introductionPairSql(viewerUserId: string, targetUserId: SQL): SQL {
  return sql`(${targetUserId} <> ${viewerUserId}
    AND ${eligibleProfileSql(sql`${viewerUserId}`)}
    AND ${eligibleProfileSql(targetUserId)}
    AND EXISTS (SELECT 1 FROM profile_basics a JOIN profile_basics b ON a.gender <> b.gender
      WHERE a.user_id = ${viewerUserId} AND b.user_id = ${targetUserId})
    AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE
      (bl.blocker_user_id = ${viewerUserId} AND bl.blocked_user_id = ${targetUserId}) OR
      (bl.blocker_user_id = ${targetUserId} AND bl.blocked_user_id = ${viewerUserId})))`;
}
export async function canAccessIntroduction(viewerUserId: string, targetProfileId: string, db: DbExecutor = getDb()): Promise<boolean> {
  const result = await db.execute(sql`SELECT 1 FROM profiles target
    WHERE target.id = ${targetProfileId}::uuid AND ${introductionPairSql(viewerUserId, sql`target.user_id`)} LIMIT 1`);
  return result.rows.length === 1;
}
/** Must run inside a transaction. Serialize profile changes against unlock/message writes. */
export async function lockIntroductionProfiles(db: DbExecutor, viewerUserId: string, targetProfileId: string) {
  await db.execute(sql`SELECT id FROM profiles WHERE user_id = ${viewerUserId} OR id = ${targetProfileId}::uuid ORDER BY id FOR UPDATE`);
}
