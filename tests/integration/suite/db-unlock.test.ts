import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
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

  return { userId, profileId: profile.id };
}

describe("integration: db-backed unlock vertical slice", () => {
  it("pass creates unlock; non-pass does not; isolation + private gate", async () => {
    const url = getIntegrationDatabaseUrl();
    await runDrizzleMigrations(url);
    await seedClosedAlphaData(url);
    const db = createIntegrationDb(url);

    const viewerA = await insertOnboardedUser(db, `a-${Date.now()}`);
    const targetB = await insertOnboardedUser(db, `b-${Date.now()}`);
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

    await observeIntegrationCase("db_unlock_pass_and_idempotent", async () => {
      const passAnswer =
        "어제 비 오는 골목에서 따뜻한 국물을 마시며 마음이 조금 풀렸어요. 창밖 소리가 선명했어요.";
      const first = await submitDbUnlockAnswer({
        viewerUserId: viewerA.userId,
        profileId: targetB.profileId,
        answer: passAnswer,
      });
      assert.equal(first.ok, true);
      if (first.ok) {
        assert.equal(first.verdict, "PASS");
        assert.equal(first.unlocked, true);
      }

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
        .where(eq(unlocks.viewerUserId, viewerA.userId));
      assert.equal(unlockRows.length, 1);

      const attempts = await db
        .select({ id: unlockAttempts.id })
        .from(unlockAttempts)
        .where(eq(unlockAttempts.viewerUserId, viewerA.userId));
      assert.ok(attempts.length >= 2);
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
    await db.delete(unlockAttempts).where(eq(unlockAttempts.viewerUserId, viewerA.userId));
    await db.delete(unlocks).where(eq(unlocks.viewerUserId, viewerA.userId));
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
