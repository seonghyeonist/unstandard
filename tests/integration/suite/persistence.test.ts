import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createIntegrationDb, getIntegrationDatabaseUrl } from "../helpers";
import { runDrizzleMigrations } from "../../../lib/db/run-migrations";
import { createBlock } from "../../../lib/db/repositories/blocks.repository";
import { createUnlock } from "../../../lib/db/repositories/unlocks.repository";
import { createDrizzleReportsRepository } from "../../../lib/db/repositories/reports.repository";
import { profiles } from "../../../lib/db/schema/profiles";
import { users } from "../../../lib/db/schema/auth";

async function insertUserWithProfile(db: ReturnType<typeof createIntegrationDb>, suffix: string) {
  const userId = `user-${suffix}`;
  await db.insert(users).values({
    id: userId,
    name: `User ${suffix}`,
    email: `${suffix}@example.com`,
    emailVerified: true,
    inviteFinalizedAt: new Date(),
  });

  const [profile] = await db
    .insert(profiles)
    .values({
      userId,
      nickname: `nick-${suffix}`,
    })
    .returning({ id: profiles.id });

  return { userId, profileId: profile.id };
}

describe("integration: persistence invariants", () => {
  it("enforces report, block, and unlock uniqueness", async () => {
    const url = getIntegrationDatabaseUrl();
    await runDrizzleMigrations(url);
    const db = createIntegrationDb(url);

    const reporter = await insertUserWithProfile(db, `reporter-${Date.now()}`);
    const target = await insertUserWithProfile(db, `target-${Date.now()}`);

    const reportsRepo = createDrizzleReportsRepository();
    const firstReport = await reportsRepo.createOrGetOpenReport({
      reporterUserId: reporter.profileId,
      targetType: "PROFILE",
      targetId: target.profileId,
      reason: "spam",
    });
    const duplicateReport = await reportsRepo.createOrGetOpenReport({
      reporterUserId: reporter.profileId,
      targetType: "PROFILE",
      targetId: target.profileId,
      reason: "spam again",
    });

    assert.equal(firstReport.ok, true);
    assert.equal(duplicateReport.ok, true);
    if (firstReport.ok && duplicateReport.ok) {
      assert.equal(duplicateReport.inserted, false);
      assert.equal(duplicateReport.reportId, firstReport.reportId);
    }

    const firstBlock = await createBlock({
      blockerUserId: reporter.userId,
      blockedUserId: target.userId,
    });
    const duplicateBlock = await createBlock({
      blockerUserId: reporter.userId,
      blockedUserId: target.userId,
    });
    assert.equal(firstBlock.ok, true);
    assert.equal(duplicateBlock.ok, true);
    if (firstBlock.ok && duplicateBlock.ok) {
      assert.equal(duplicateBlock.inserted, false);
    }

    const firstUnlock = await createUnlock({
      viewerUserId: reporter.userId,
      profileId: target.profileId,
    });
    const duplicateUnlock = await createUnlock({
      viewerUserId: reporter.userId,
      profileId: target.profileId,
    });
    assert.equal(firstUnlock.ok, true);
    assert.equal(duplicateUnlock.ok, true);
    if (firstUnlock.ok && duplicateUnlock.ok) {
      assert.equal(duplicateUnlock.inserted, false);
    }
  });
});
