import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { inArray, sql } from "drizzle-orm";
import { createIntegrationDb, getIntegrationDatabaseUrl } from "../helpers";
import { runDrizzleMigrations } from "../../../lib/db/run-migrations";
import { extractPgErrorCode } from "../../../lib/db/errors";
import { createBlock } from "../../../lib/db/repositories/blocks.repository";
import { createUnlock } from "../../../lib/db/repositories/unlocks.repository";
import { createDrizzleReportsRepository } from "../../../lib/db/repositories/reports.repository";
import { reports } from "../../../lib/db/schema/reports";
import { messages } from "../../../lib/db/schema/messages";
import { alphaActivityDays } from "../../../lib/db/schema/alpha-activity";
import { alphaProfileExposures } from "../../../lib/db/schema/alpha-exposures";
import { waitlistEntries, waitlistVisitDays } from "../../../lib/db/schema/waitlist";
import { profiles } from "../../../lib/db/schema/profiles";
import { users } from "../../../lib/db/schema/auth";
import { observeIntegrationCase } from "../../../lib/readiness/integration-case-log";
import { createMessage, listConversation } from "../../../lib/db/repositories/messages.repository";
import {
  deleteWaitlistEntry,
  joinWaitlist,
  recordWaitlistVisit,
} from "../../../lib/waitlist/waitlist.repository";
import { buildAlphaMetricsSnapshot } from "../../../lib/alpha/metrics-snapshot";

const fixtureUserIds = new Set<string>();

async function insertUserWithProfile(db: ReturnType<typeof createIntegrationDb>, suffix: string) {
  const userId = `user-${suffix}`;
  fixtureUserIds.add(userId);
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
      onboardedAt: new Date(),
    })
    .returning({ id: profiles.id });

  return { userId, profileId: profile.id };
}

after(async () => {
  const db = createIntegrationDb(getIntegrationDatabaseUrl());
  const userIds = [...fixtureUserIds];
  if (userIds.length === 0) return;

  await db.delete(users).where(inArray(users.id, userIds));
  const remaining = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, userIds));
  assert.equal(remaining.length, 0, "persistence integration users must be removed");
});

describe("integration: persistence invariants", () => {
  it("message_unlock_block_authorization + message_deletion_residuals", async () => {
    const url = getIntegrationDatabaseUrl();
    await runDrizzleMigrations(url);
    const db = createIntegrationDb(url);
    const sender = await insertUserWithProfile(db, `message-sender-${Date.now()}`);
    const recipient = await insertUserWithProfile(db, `message-recipient-${Date.now()}`);
    const unlocked = await createUnlock({
      viewerUserId: sender.userId,
      profileId: recipient.profileId,
    });
    assert.equal(unlocked.ok, true);

    let messageId = "";
    await observeIntegrationCase("message_unlock_block_authorization", async () => {
      const created = await createMessage({
        viewerUserId: sender.userId,
        targetProfileId: recipient.profileId,
        body: "A durable first message with enough detail.",
      });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      messageId = created.message.id;

      const recipientView = await listConversation({
        viewerUserId: recipient.userId,
        targetProfileId: sender.profileId,
      });
      assert.equal(recipientView.ok, true);
      if (recipientView.ok) {
        assert.equal(recipientView.messages.length, 1);
        assert.equal(recipientView.messages[0]?.author, "them");
      }

      const blocked = await createBlock({
        blockerUserId: recipient.userId,
        blockedUserId: sender.userId,
      });
      assert.equal(blocked.ok, true);
      const denied = await createMessage({
        viewerUserId: sender.userId,
        targetProfileId: recipient.profileId,
        body: "This must not be persisted.",
      });
      assert.deepEqual(denied, { ok: false, code: "BLOCKED" });
    });

    await db.insert(reports).values({
      reporterUserId: recipient.userId,
      targetType: "message",
      targetId: messageId,
      reason: "deletion residual proof",
    });
    await db.insert(alphaActivityDays).values({
      userId: sender.userId,
      activityDate: new Date().toISOString().slice(0, 10),
    });
    await db.insert(alphaProfileExposures).values({
      viewerUserId: sender.userId,
      targetProfileId: recipient.profileId,
    });

    await observeIntegrationCase("message_deletion_residuals", async () => {
      await db.delete(users).where(sql`${users.id} = ${sender.userId}`);
      const [messageRows, reportRows, activityRows, exposureRows] = await Promise.all([
        db.select({ id: messages.id }).from(messages).where(sql`${messages.id} = ${messageId}`),
        db.select({ id: reports.id }).from(reports).where(sql`${reports.targetId} = ${messageId}`),
        db.select({ id: alphaActivityDays.id }).from(alphaActivityDays).where(sql`${alphaActivityDays.userId} = ${sender.userId}`),
        db.select({ id: alphaProfileExposures.id }).from(alphaProfileExposures).where(sql`${alphaProfileExposures.viewerUserId} = ${sender.userId}`),
      ]);
      assert.equal(messageRows.length, 0);
      assert.equal(reportRows.length, 0);
      assert.equal(activityRows.length, 0);
      assert.equal(exposureRows.length, 0);
    });
  });

  it("waitlist_revisit_and_delete + alpha_metrics_fail_closed_maturity", async () => {
    process.env.WAITLIST_TOKEN_PEPPER = "integration-waitlist-pepper";
    const url = getIntegrationDatabaseUrl();
    await runDrizzleMigrations(url);
    const db = createIntegrationDb(url);
    const joinedAt = new Date("2026-08-01T12:00:00.000Z");
    const email = `waitlist-${Date.now()}@example.com`;
    const joined = await joinWaitlist({
      email,
      acquisitionChannel: "organic",
      now: joinedAt,
    });
    assert.equal(joined.created, true);
    if (!joined.created) return;

    await observeIntegrationCase("waitlist_revisit_and_delete", async () => {
      assert.equal(await recordWaitlistVisit(joined.rawToken, joinedAt), true);
      assert.equal(
        await recordWaitlistVisit(joined.rawToken, new Date("2026-08-02T12:00:00.000Z")),
        true,
      );
      const [entry] = await db
        .select({ id: waitlistEntries.id })
        .from(waitlistEntries)
        .where(sql`${waitlistEntries.emailNormalized} = ${email}`)
        .limit(1);
      assert.ok(entry);
      const visits = await db
        .select({ id: waitlistVisitDays.id })
        .from(waitlistVisitDays)
        .where(sql`${waitlistVisitDays.waitlistEntryId} = ${entry.id}`);
      assert.equal(visits.length, 2);
      assert.equal(await deleteWaitlistEntry(joined.rawToken), true);
      const residual = await db
        .select({ id: waitlistEntries.id })
        .from(waitlistEntries)
        .where(sql`${waitlistEntries.emailNormalized} = ${email}`);
      assert.equal(residual.length, 0);
    });

    await observeIntegrationCase("alpha_metrics_fail_closed_maturity", async () => {
      const snapshot = await buildAlphaMetricsSnapshot(new Date("2026-08-12T00:00:00.000Z"));
      assert.notEqual(snapshot.decision.decision, "GO");
      assert.equal(JSON.stringify(snapshot).includes("@example.com"), false);
      assert.match(snapshot.contentDigest, /^[a-f0-9]{64}$/u);
    });
  });

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
