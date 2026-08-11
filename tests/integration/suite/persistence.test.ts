import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sql } from "drizzle-orm";
import { createIntegrationDb, getIntegrationDatabaseUrl } from "../helpers";
import { runDrizzleMigrations } from "../../../lib/db/run-migrations";
import { extractPgErrorCode } from "../../../lib/db/errors";
import { createBlock } from "../../../lib/db/repositories/blocks.repository";
import { createUnlock } from "../../../lib/db/repositories/unlocks.repository";
import { createDrizzleReportsRepository } from "../../../lib/db/repositories/reports.repository";
import { reports } from "../../../lib/db/schema/reports";
import { profiles } from "../../../lib/db/schema/profiles";
import { users } from "../../../lib/db/schema/auth";
import { observeIntegrationCase } from "../../../lib/readiness/integration-case-log";

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
  it("report_user_fk + duplicate_report_idempotency + no_duplicate_report_row", async () => {
    const url = getIntegrationDatabaseUrl();
    await runDrizzleMigrations(url);
    const db = createIntegrationDb(url);

    const reporter = await insertUserWithProfile(db, `reporter-${Date.now()}`);
    const target = await insertUserWithProfile(db, `target-${Date.now()}`);

    const reportsRepo = createDrizzleReportsRepository();
    const firstReport = await reportsRepo.createOrGetOpenReport({
      reporterUserId: reporter.userId,
      targetType: "profile",
      targetId: target.profileId,
      reason: "spam",
    });
    const duplicateReport = await reportsRepo.createOrGetOpenReport({
      reporterUserId: reporter.userId,
      targetType: "profile",
      targetId: target.profileId,
      reason: "spam again",
    });

    await observeIntegrationCase("report_user_fk", async () => {
      assert.equal(firstReport.ok, true);
      if (firstReport.ok) {
        const rows = await db
          .select({
            reporterUserId: reports.reporterUserId,
          })
          .from(reports)
          .where(sql`${reports.id} = ${firstReport.reportId}`);
        assert.equal(rows[0]?.reporterUserId, reporter.userId);
        assert.notEqual(rows[0]?.reporterUserId, reporter.profileId);
      }
    });

    await observeIntegrationCase("duplicate_report_idempotency", async () => {
      assert.equal(firstReport.ok, true);
      assert.equal(duplicateReport.ok, true);
      if (firstReport.ok && duplicateReport.ok) {
        assert.equal(firstReport.inserted, true);
        assert.equal(duplicateReport.inserted, false);
        assert.equal(duplicateReport.reportId, firstReport.reportId);
      }
    });

    await observeIntegrationCase("no_duplicate_report_row", async () => {
      const rows = await db
        .select({
          id: reports.id,
          reporterUserId: reports.reporterUserId,
          targetType: reports.targetType,
        })
        .from(reports)
        .where(
          sql`${reports.reporterUserId} = ${reporter.userId} AND ${reports.targetType} = ${"profile"} AND ${reports.targetId} = ${target.profileId}`,
        );
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.targetType, "profile");
    });
  });

  it("lowercase_report_target_type", async () => {
    const url = getIntegrationDatabaseUrl();
    const db = createIntegrationDb(url);
    const reporter = await insertUserWithProfile(db, `uppercase-${Date.now()}`);
    const target = await insertUserWithProfile(db, `uppercase-target-${Date.now()}`);

    await observeIntegrationCase("lowercase_report_target_type", async () => {
      await assert.rejects(
        () =>
          db.insert(reports).values({
            reporterUserId: reporter.userId,
            targetType: "PROFILE",
            targetId: target.profileId,
            reason: "invalid type",
            status: "OPEN",
          }),
        (error: unknown) => extractPgErrorCode(error) === "23514",
      );
    });
  });

  it("block_uniqueness + unlock_uniqueness", async () => {
    const url = getIntegrationDatabaseUrl();
    const db = createIntegrationDb(url);

    const reporter = await insertUserWithProfile(db, `block-${Date.now()}`);
    const target = await insertUserWithProfile(db, `block-target-${Date.now()}`);

    await observeIntegrationCase("block_uniqueness", async () => {
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
    });

    await observeIntegrationCase("unlock_uniqueness", async () => {
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
});
