import "server-only";

import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { eligibleProfileSql, introductionPairSql } from "@/lib/db/repositories/introduction-policy";
import { profileBasics } from "@/lib/db/schema/profile-basics";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema/profiles";
import { getConfiguredUnlockQuestion } from "@/lib/server/unlock/question-config";
import { isUuid } from "@/lib/server/unlock/uuid";

export type PublicCandidateRow = {
  id: string;
  nickname: string;
  city: string;
  teaser: string;
  question: string;
  age: number;
  gender: "male" | "female";
};

export type PublicProfileRow = PublicCandidateRow & {
  locked: {
    softFacts: string[];
    blurredNote: string;
  };
};

/**
 * Database-runtime public candidates:
 * - exclude viewer's own profile
 * - onboarded_at IS NOT NULL only
 * - no private fields
 * - id is real profiles.id UUID
 */
export async function listPublicCandidatesForViewer(
  viewerUserId: string,
): Promise<PublicCandidateRow[] | "question_missing" | "setup_required"> {
  const eligibility = await getDb().execute(sql`SELECT ${eligibleProfileSql(sql`${viewerUserId}`)} AS eligible`);
  if (!eligibility.rows[0]?.eligible) return "setup_required";

  const question = await getConfiguredUnlockQuestion();
  if (!question) {
    return "question_missing";
  }

  const db = getDb();
  const rows = await db
    .select({
      id: profiles.id,
      nickname: profiles.nickname,
      city: profileBasics.region,
      age: profileBasics.age,
      gender: profileBasics.gender,
      teaser: profiles.teaser,
    })
    .from(profiles)
    .innerJoin(profileBasics, eq(profileBasics.userId, profiles.userId))
    .where(and(isNotNull(profiles.onboardedAt), ne(profiles.userId, viewerUserId), introductionPairSql(viewerUserId, sql`${profiles.userId}`)))
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    nickname: row.nickname,
    age: row.age,
    gender: row.gender as "male" | "female",
    city: row.city?.trim() || "미정",
    teaser: row.teaser?.trim() || "아직 짧은 소개가 없어요.",
    question: question.prompt,
  }));
}

export async function getPublicProfileById(
  profileId: string,
  viewerUserId: string,
): Promise<PublicProfileRow | "invalid" | "not_found" | "question_missing"> {
  if (!isUuid(profileId)) {
    return "invalid";
  }

  const question = await getConfiguredUnlockQuestion();
  if (!question) {
    return "question_missing";
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: profiles.id,
      nickname: profiles.nickname,
      city: profileBasics.region,
      age: profileBasics.age,
      gender: profileBasics.gender,
      teaser: profiles.teaser,
      onboardedAt: profiles.onboardedAt,
    })
    .from(profiles)
    .innerJoin(profileBasics, eq(profileBasics.userId, profiles.userId))
    .where(and(eq(profiles.id, profileId), introductionPairSql(viewerUserId, sql`${profiles.userId}`)))
    .limit(1);

  if (!row || !row.onboardedAt) {
    return "not_found";
  }

  return {
    id: row.id,
    nickname: row.nickname,
    age: row.age,
    gender: row.gender as "male" | "female",
    city: row.city?.trim() || "미정",
    teaser: row.teaser?.trim() || "아직 짧은 소개가 없어요.",
    question: question.prompt,
    locked: {
      softFacts: ["답장을 천천히 다정하게 하는 편", "작은 장면을 잘 기억하는 편"],
      blurredNote: "이 사람의 취향과 첫 메시지 힌트가 아직 가려져 있어요.",
    },
  };
}

export async function getTargetProfileForUnlock(profileId: string): Promise<
  | { ok: true; profileId: string; userId: string; onboarded: boolean }
  | { ok: false; reason: "invalid" | "not_found" }
> {
  if (!isUuid(profileId)) {
    return { ok: false, reason: "invalid" };
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: profiles.id,
      userId: profiles.userId,
      onboardedAt: profiles.onboardedAt,
    })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!row) {
    return { ok: false, reason: "not_found" };
  }

  return {
    ok: true,
    profileId: row.id,
    userId: row.userId,
    onboarded: Boolean(row.onboardedAt),
  };
}
