import { profileBasicsRepository } from "../../../lib/db/repositories/profile-basics.repository";
import { identityRepository } from "../../../lib/db/repositories/identity.repository";
import { canAccessIntroduction } from "../../../lib/db/repositories/introduction-policy";
import { getPublicProfileById, listPublicCandidatesForViewer } from "../../../lib/db/repositories/candidates.repository";
import { createMessage, listConversation } from "../../../lib/db/repositories/messages.repository";
import { identityVerifications, profileBasics } from "../../../lib/db/schema/profile-basics";
import { INTRODUCTION_SCOPE_VERSION, PROFILE_CONSENT_VERSION } from "../../../lib/profile/basics";
import { addSyntheticVerifiedBasics } from "../profile-fixture";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { createIntegrationDb, getIntegrationDatabaseUrl } from "../helpers";
import { runDrizzleMigrations } from "../../../lib/db/run-migrations";
import { seedClosedAlphaData } from "../../../lib/db/seed-data";
import { users } from "../../../lib/db/schema/auth";
import { profiles, profilePrivate } from "../../../lib/db/schema/profiles";
import { unlocks } from "../../../lib/db/schema/unlocks";
import { unlockAttempts } from "../../../lib/db/schema/unlock-attempts";
import { submitDbUnlockAnswer, getDbUnlockStatus } from "../../../lib/server/unlock/db-unlock.service";
import { getDbPrivateProfile } from "../../../lib/db/repositories/profile-private.repository";
import { observeIntegrationCase } from "../../../lib/readiness/integration-case-log";
import { createUnlock } from "../../../lib/db/repositories/unlocks.repository";

async function insertOnboardedUser(
  db: ReturnType<typeof createIntegrationDb>,
  suffix: string,
  gender: "male" | "female" = "male",
) {
  const userId = `unlock-user-${suffix}`;
  await db.insert(users).values({
    id: userId,
    name: `Unlock ${suffix}`,
    email: `${suffix}@example.com`,
    emailVerified: true,
    inviteFinalizedAt: new Date(),
  });
  const [profile] = await db
    .insert(profiles)
    .values({
      userId,
      nickname: `nick-${suffix}`.slice(0, 16),
      city: "서울",
      teaser: "작은 장면을 좋아해요.",
      onboardedAt: new Date(),
    })
    .returning({ id: profiles.id });

  await db.insert(profilePrivate).values({
    profileId: profile.id,
    letter: `letter-${suffix}`,
    smallJoys: ["tea"],
  });

  await addSyntheticVerifiedBasics(db, userId, gender);
  return { userId, profileId: profile.id };
}

describe("integration: db-backed unlock vertical slice", () => {
  it("profile eligibility, direct access, revision binding and deletion fail closed", async () => {
    const url = getIntegrationDatabaseUrl();
    await runDrizzleMigrations(url);
    await seedClosedAlphaData(url);
    const db = createIntegrationDb(url);
    const a = await insertOnboardedUser(db, `basics-a-${Date.now()}`, "male");
    const b = await insertOnboardedUser(db, `basics-b-${Date.now()}`, "female");
    const same = await insertOnboardedUser(db, `basics-same-${Date.now()}`, "male");
    const passAnswer = "어제 비 오는 골목에서 따뜻한 국물을 마시며 마음이 조금 풀렸어요. 창밖 소리가 선명했어요.";
    try {
      assert.equal(await canAccessIntroduction(a.userId, b.profileId), true);
      assert.equal(await canAccessIntroduction(a.userId, same.profileId), false);
      assert.equal(await getPublicProfileById(same.profileId, a.userId), "not_found");
      assert.equal((await submitDbUnlockAnswer({ viewerUserId: a.userId, profileId: b.profileId, answer: passAnswer })).ok, true);
      assert.equal((await createMessage({ viewerUserId: a.userId, targetProfileId: b.profileId, body: "synthetic message" })).ok, true);
      const input = { nickname: "new-nick", gender: "female" as const, age: 23, region: "서울" as const,
        introductionScopeAccepted: true, profileConsentAccepted: true as const,
        profileConsentVersion: PROFILE_CONSENT_VERSION, introductionScopeVersion: INTRODUCTION_SCOPE_VERSION };
      await profileBasicsRepository.save(b.userId, input);
      assert.equal(await canAccessIntroduction(a.userId, b.profileId), false);
      assert.equal(await getPublicProfileById(b.profileId, a.userId), "not_found");
      assert.equal((await getDbPrivateProfile({ viewerUserId: a.userId, profileId: b.profileId })).ok, false);
      assert.equal((await listConversation({ viewerUserId: a.userId, targetProfileId: b.profileId })).ok, false);
      assert.equal((await createMessage({ viewerUserId: a.userId, targetProfileId: b.profileId, body: "blocked message" })).ok, false);
      assert.equal((await getDbUnlockStatus({ viewerUserId: a.userId, profileId: b.profileId })).ok, false);
      assert.equal(await listPublicCandidatesForViewer(b.userId), "setup_required");
      const pending = await identityRepository.begin(b.userId, "test-only", new Date());
      assert.ok(pending);
      await profileBasicsRepository.save(b.userId, { ...input, age: 24 });
      assert.equal(await identityRepository.complete(pending, new Date()), false);
      const fresh = await identityRepository.begin(b.userId, "test-only", new Date());
      assert.ok(fresh);
      assert.equal(await identityRepository.find(a.userId, fresh.requestId), null);
      assert.equal(await identityRepository.complete(fresh, new Date()), true);
      assert.equal(await canAccessIntroduction(a.userId, b.profileId), true);
      await profileBasicsRepository.withdraw(b.userId);
      assert.equal((await profileBasicsRepository.read(b.userId)).basics, null);
      assert.equal((await db.select().from(identityVerifications).where(eq(identityVerifications.userId, b.userId))).length, 0);
      assert.equal(await canAccessIntroduction(a.userId, b.profileId), false);
      await db.delete(users).where(eq(users.id, a.userId));
      assert.equal((await db.select().from(profileBasics).where(eq(profileBasics.userId, a.userId))).length, 0);
      assert.equal((await db.select().from(identityVerifications).where(eq(identityVerifications.userId, a.userId))).length, 0);
    } finally {
      for (const f of [a, b, same]) await db.delete(users).where(eq(users.id, f.userId));
    }
  });

  it("pass creates unlock; non-pass does not; isolation + private gate", async () => {
    const url = getIntegrationDatabaseUrl();
    await runDrizzleMigrations(url);
    await seedClosedAlphaData(url);
    const db = createIntegrationDb(url);

    const viewerA = await insertOnboardedUser(db, `a-${Date.now()}`);
    const targetB = await insertOnboardedUser(db, `b-${Date.now()}`, "female");
    const stranger = await insertOnboardedUser(db, `c-${Date.now()}`);

    await observeIntegrationCase("db_unlock_reject_no_row", async () => {
      const rejected = await submitDbUnlockAnswer({
        viewerUserId: viewerA.userId,
        profileId: targetB.profileId,
        answer: "네네네네네네네네네네네네",
      });
      assert.equal(rejected.ok, true);
      if (rejected.ok) {
        assert.notEqual(rejected.verdict, "PASS");
        assert.equal(rejected.unlocked, false);
      }
      const unlockRows = await db
        .select({ id: unlocks.id })
        .from(unlocks)
        .where(eq(unlocks.viewerUserId, viewerA.userId));
      assert.equal(unlockRows.length, 0);
    });

    const passAnswer =
      "어제 비 오는 골목에서 따뜻한 국물을 마시며 마음이 조금 풀렸어요. 창밖 소리가 선명했어요.";

    await observeIntegrationCase("pass_transaction_commits_attempt_and_unlock", async () => {
      const first = await submitDbUnlockAnswer({
        viewerUserId: viewerA.userId,
        profileId: targetB.profileId,
        answer: passAnswer,
      });
      assert.equal(first.ok, true);
      if (first.ok) {
        assert.equal(first.verdict, "PASS");
        assert.equal(first.unlocked, true);
        assert.equal(first.idempotent, false);
      }

      const unlockRows = await db
        .select({ id: unlocks.id })
        .from(unlocks)
        .where(
          and(
            eq(unlocks.viewerUserId, viewerA.userId),
            eq(unlocks.profileId, targetB.profileId),
          ),
        );
      const attempts = await db
        .select({ id: unlockAttempts.id })
        .from(unlockAttempts)
        .where(
          and(
            eq(unlockAttempts.viewerUserId, viewerA.userId),
            eq(unlockAttempts.targetProfileId, targetB.profileId),
          ),
        );
      assert.equal(unlockRows.length, 1);
      assert.equal(attempts.length, 2);
    });

    await observeIntegrationCase("duplicate_unlock_single_row", async () => {
      const second = await submitDbUnlockAnswer({
        viewerUserId: viewerA.userId,
        profileId: targetB.profileId,
        answer: passAnswer,
      });
      assert.equal(second.ok, true);
      if (second.ok) {
        assert.equal(second.verdict, "PASS");
        assert.equal(second.unlocked, true);
        assert.equal(second.idempotent, true);
      }

      const unlockRows = await db
        .select({ id: unlocks.id })
        .from(unlocks)
        .where(
          and(
            eq(unlocks.viewerUserId, viewerA.userId),
            eq(unlocks.profileId, targetB.profileId),
          ),
        );
      assert.equal(unlockRows.length, 1);

      const attempts = await db
        .select({ id: unlockAttempts.id })
        .from(unlockAttempts)
        .where(
          and(
            eq(unlockAttempts.viewerUserId, viewerA.userId),
            eq(unlockAttempts.targetProfileId, targetB.profileId),
          ),
        );
      assert.equal(attempts.length, 3);
    });

    await observeIntegrationCase("unlock_failure_rolls_back_attempt", async () => {
      await db.execute(sql`
        CREATE OR REPLACE FUNCTION test_fail_unlock_insert()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RAISE EXCEPTION 'forced unlock insert failure';
        END;
        $$
      `);
      await db.execute(sql`
        CREATE TRIGGER test_fail_unlock_insert
        BEFORE INSERT ON unlocks
        FOR EACH ROW
        EXECUTE FUNCTION test_fail_unlock_insert()
      `);

      const logLines: string[] = [];
      const originalConsoleError = console.error;
      console.error = (...args: unknown[]) => {
        logLines.push(args.map(String).join(" "));
      };
      try {
        const failed = await submitDbUnlockAnswer({
          viewerUserId: stranger.userId,
          profileId: targetB.profileId,
          answer: passAnswer,
        });
        assert.equal(failed.ok, false);
        if (!failed.ok) assert.equal(failed.code, "PERSISTENCE_FAILED");
      } finally {
        console.error = originalConsoleError;
        await db.execute(sql`DROP TRIGGER IF EXISTS test_fail_unlock_insert ON unlocks`);
        await db.execute(sql`DROP FUNCTION IF EXISTS test_fail_unlock_insert()`);
      }

      const failedAttempts = await db
        .select({ id: unlockAttempts.id })
        .from(unlockAttempts)
        .where(
          and(
            eq(unlockAttempts.viewerUserId, stranger.userId),
            eq(unlockAttempts.targetProfileId, targetB.profileId),
          ),
        );
      const failedUnlocks = await db
        .select({ id: unlocks.id })
        .from(unlocks)
        .where(
          and(
            eq(unlocks.viewerUserId, stranger.userId),
            eq(unlocks.profileId, targetB.profileId),
          ),
        );
      assert.equal(failedAttempts.length, 0);
      assert.equal(failedUnlocks.length, 0);
      assert.equal(logLines.some((line) => line.includes(passAnswer)), false);
    });

    await observeIntegrationCase("db_unlock_viewer_isolation", async () => {
      const statusA = await getDbUnlockStatus({
        viewerUserId: viewerA.userId,
        profileId: targetB.profileId,
      });
      const statusStranger = await getDbUnlockStatus({
        viewerUserId: stranger.userId,
        profileId: targetB.profileId,
      });
      assert.equal(statusA.ok, true);
      assert.equal(statusStranger.ok, true);
      if (statusA.ok && statusStranger.ok) {
        assert.equal(statusA.unlocked, true);
        assert.equal(statusStranger.unlocked, false);
      }
    });

    await observeIntegrationCase("db_private_profile_gate", async () => {
      const before = await getDbPrivateProfile({
        viewerUserId: stranger.userId,
        profileId: targetB.profileId,
      });
      assert.equal(before.ok, false);
      if (!before.ok) assert.equal(before.code, "FORBIDDEN");

      const after = await getDbPrivateProfile({
        viewerUserId: viewerA.userId,
        profileId: targetB.profileId,
      });
      assert.equal(after.ok, true);
      if (after.ok) {
        assert.equal(after.body.letter.includes("letter-"), true);
        assert.equal("email" in after.body, false);
      }
    });

    await observeIntegrationCase("bidirectional_viewer_isolation", async () => {
      const before = await getDbPrivateProfile({
        viewerUserId: targetB.userId,
        profileId: viewerA.profileId,
      });
      assert.equal(before.ok, false);
      if (!before.ok) assert.equal(before.code, "FORBIDDEN");

      const reverse = await submitDbUnlockAnswer({
        viewerUserId: targetB.userId,
        profileId: viewerA.profileId,
        answer: passAnswer,
      });
      assert.equal(reverse.ok, true);
      if (reverse.ok) {
        assert.equal(reverse.verdict, "PASS");
        assert.equal(reverse.unlocked, true);
      }

      const forwardStatus = await getDbUnlockStatus({
        viewerUserId: viewerA.userId,
        profileId: targetB.profileId,
      });
      const reverseStatus = await getDbUnlockStatus({
        viewerUserId: targetB.userId,
        profileId: viewerA.profileId,
      });
      assert.equal(forwardStatus.ok, true);
      assert.equal(reverseStatus.ok, true);
      if (forwardStatus.ok && reverseStatus.ok) {
        assert.equal(forwardStatus.unlockRowCount, 1);
        assert.equal(reverseStatus.unlockRowCount, 1);
      }
    });

    await observeIntegrationCase("db_unlock_self_denied", async () => {
      const self = await submitDbUnlockAnswer({
        viewerUserId: viewerA.userId,
        profileId: viewerA.profileId,
        answer: "나는 나를 열 수 없어야 하는 충분히 긴 답변입니다.",
      });
      assert.equal(self.ok, false);
      if (!self.ok) assert.equal(self.code, "SELF_UNLOCK_NOT_ALLOWED");
    });

    await observeIntegrationCase("db_unlock_invalid_uuid", async () => {
      const invalid = await submitDbUnlockAnswer({
        viewerUserId: viewerA.userId,
        profileId: "c3",
        answer: "mock id 는 database runtime 에서 거부되어야 합니다 충분히 길게.",
      });
      assert.equal(invalid.ok, false);
      if (!invalid.ok) assert.equal(invalid.code, "INVALID_PROFILE_ID");
    });

    // cleanup
    for (const row of [viewerA, targetB, stranger]) {
      await db.delete(unlockAttempts).where(eq(unlockAttempts.viewerUserId, row.userId));
      await db.delete(unlocks).where(eq(unlocks.viewerUserId, row.userId));
    }
    for (const row of [viewerA, targetB, stranger]) {
      await db.delete(profilePrivate).where(eq(profilePrivate.profileId, row.profileId));
      await db.delete(profiles).where(eq(profiles.id, row.profileId));
      await db.delete(users).where(eq(users.id, row.userId));
    }

    // keep createUnlock regression nearby
    void createUnlock;
    void randomUUID;
  });
});
