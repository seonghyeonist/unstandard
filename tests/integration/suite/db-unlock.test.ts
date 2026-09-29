import { profileBasicsRepository } from "../../../lib/db/repositories/profile-basics.repository";
import {
  identityProviderPurgeQueueRepository,
  identityRepository,
} from "../../../lib/db/repositories/identity.repository";
import { canAccessIntroduction } from "../../../lib/db/repositories/introduction-policy";
import { getPublicProfileById, listPublicCandidatesForViewer } from "../../../lib/db/repositories/candidates.repository";
import { createMessage, listConversation } from "../../../lib/db/repositories/messages.repository";
import {
  identityProviderPurgeQueue,
  identityVerifications,
  profileBasics,
} from "../../../lib/db/schema/profile-basics";
import { INTRODUCTION_SCOPE_VERSION, PROFILE_CONSENT_VERSION } from "../../../lib/profile/basics";
import { IDENTITY_BIOMETRIC_CONSENT_VERSION } from "../../../lib/identity/contracts";
import { addSyntheticProfileBasics, addSyntheticVerifiedBasics } from "../profile-fixture";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { and, eq, inArray, sql } from "drizzle-orm";
import { closeIntegrationDatabases, createIntegrationDb, getIntegrationDatabaseUrl } from "../helpers";
import { seedClosedAlphaData } from "../../../lib/db/seed-data";
import { users } from "../../../lib/db/schema/auth";
import { profiles, profilePrivate } from "../../../lib/db/schema/profiles";
import { unlocks } from "../../../lib/db/schema/unlocks";
import { unlockAttempts } from "../../../lib/db/schema/unlock-attempts";
import { submitDbUnlockAnswer, getDbUnlockStatus } from "../../../lib/server/unlock/db-unlock.service";
import { getDbPrivateProfile } from "../../../lib/db/repositories/profile-private.repository";
import { observeIntegrationCase } from "../../../lib/readiness/integration-case-log";
import { createUnlock } from "../../../lib/db/repositories/unlocks.repository";

function safeErrorName(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,40}$/u.test(name)
    ? name
    : "UnknownError";
}

after(async () => closeIntegrationDatabases());

function safeErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]{2,32}$/u.test(code) ? code : null;
}

async function traceDbStep<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const startedAt = new Date();
  console.info(JSON.stringify({
    event: "integration.db_unlock_sql_boundary",
    boundary: name,
    phase: "start",
    started_at: startedAt.toISOString(),
  }));
  try {
    const value = await operation();
    console.info(JSON.stringify({
      event: "integration.db_unlock_sql_boundary",
      boundary: name,
      phase: "end",
      outcome: "PASS",
      ended_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startedAt.getTime(),
    }));
    return value;
  } catch (error) {
    console.info(JSON.stringify({
      event: "integration.db_unlock_sql_boundary",
      boundary: name,
      phase: "end",
      outcome: "FAIL",
      ended_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startedAt.getTime(),
      error_name: safeErrorName(error),
      error_code: safeErrorCode(error),
    }));
    throw error;
  }
}

async function insertOnboardedUser(
  db: ReturnType<typeof createIntegrationDb>,
  suffix: string,
  gender: "male" | "female" = "male",
  includeVerifiedIdentity = true,
  includePrivateProfile = true,
) {
  const userId = `unlock-user-${suffix}`;
  await traceDbStep("insert_user", () => db.insert(users).values({
    id: userId,
    name: `Unlock ${suffix}`,
    email: `${suffix}@example.com`,
    emailVerified: true,
    inviteFinalizedAt: new Date(),
  }));
  const [profile] = await traceDbStep("insert_profile", () => db
    .insert(profiles)
    .values({
      userId,
      nickname: `nick-${suffix}`.slice(0, 16),
      city: "서울",
      teaser: "작은 장면을 좋아해요.",
      onboardedAt: new Date(),
    })
    .returning({ id: profiles.id }));

  if (includePrivateProfile) {
    await traceDbStep("insert_private_profile", () => db.insert(profilePrivate).values({
      profileId: profile.id,
      letter: `letter-${suffix}`,
      smallJoys: ["tea"],
    }));
  }

  if (includeVerifiedIdentity) {
    await traceDbStep("insert_verified_profile_basics", () => addSyntheticVerifiedBasics(db, userId, gender));
  } else {
    await traceDbStep("insert_profile_basics", () => addSyntheticProfileBasics(db, userId, gender));
  }
  return { userId, profileId: profile.id };
}

describe("integration: db-backed unlock vertical slice", () => {
  it("queues only opaque Didit references after account deletion and bounds retries", async () => {
    const url = getIntegrationDatabaseUrl();
    const suffix = `purge-${Date.now()}`;
    const firstSuffix = `${suffix}-a`;
    const secondSuffix = `${suffix}-b`;
    const userIds = [
      `unlock-user-${firstSuffix}`,
      `unlock-user-${secondSuffix}`,
    ];
    const queueIds: string[] = [];
    let db: ReturnType<typeof createIntegrationDb> | null = null;
    let phase = "seed_closed_alpha_data";
    let failure: { phase: string; name: string; code: string | null; operator: string | null } | null = null;
    let cleanupFailed = false;

    const boundary = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
      phase = name;
      const startedAt = new Date();
      console.info(JSON.stringify({
        event: "integration.db_unlock_boundary",
        boundary: name,
        phase: "start",
        started_at: startedAt.toISOString(),
      }));
      try {
        const value = await operation();
        console.info(JSON.stringify({
          event: "integration.db_unlock_boundary",
          boundary: name,
          phase: "end",
          outcome: "PASS",
          ended_at: new Date().toISOString(),
          elapsed_ms: Date.now() - startedAt.getTime(),
        }));
        return value;
      } catch (error) {
        console.info(JSON.stringify({
          event: "integration.db_unlock_boundary",
          boundary: name,
          phase: "end",
          outcome: "FAIL",
          ended_at: new Date().toISOString(),
          elapsed_ms: Date.now() - startedAt.getTime(),
          error_name: safeErrorName(error),
          error_code: safeErrorCode(error),
        }));
        throw error;
      }
    };

    try {
      db = createIntegrationDb(url);
      const first = await boundary("insert_first_account", () =>
        insertOnboardedUser(db!, firstSuffix, "male", false, false),
      );

      const pending = await boundary("begin_first_identity_request", () => identityRepository.begin(
        first.userId,
        "didit-v3",
        IDENTITY_BIOMETRIC_CONSENT_VERSION,
        new Date(),
      ));
      phase = "assert_first_identity_request_created";
      assert.ok(pending);
      const providerReference = randomUUID();
      queueIds.push(pending!.requestId);
      phase = "bind_first_provider_reference";
      assert.equal(
        await boundary("bind_first_provider_reference", () =>
          identityRepository.bindProviderReference(pending!, providerReference),
        ),
        true,
        "provider reference binding must succeed",
      );
      phase = "assert_first_identity_request_queued";

      await boundary("delete_first_account", () => db!.delete(users).where(eq(users.id, first.userId)));
      phase = "read_first_verification_after_delete";
      assert.equal(
        (await boundary("read_first_verification_after_delete", () =>
          db!.select().from(identityVerifications).where(eq(identityVerifications.userId, first.userId)),
        )).length,
        0,
        "deleting account must remove identity verification",
      );

      const [queued] = await boundary("read_first_purge_queue_row", () => db!
        .select()
        .from(identityProviderPurgeQueue)
        .where(eq(identityProviderPurgeQueue.requestId, pending!.requestId)));
      phase = "assert_first_purge_queue_shape";
      assert.ok(queued);
      assert.deepEqual(Object.keys(queued!).sort(), [
        "attemptCount",
        "nextAttemptAt",
        "provider",
        "providerReference",
        "queuedAt",
        "requestId",
      ], "purge queue row must contain opaque reference fields only");
      phase = "assert_first_purge_provider";
      assert.equal(queued!.provider, "didit-v3", "purge queue provider mismatch");
      phase = "assert_first_purge_reference";
      assert.ok(queued!.providerReference === providerReference, "opaque provider reference mismatch");
      phase = "assert_first_purge_attempt_count";
      assert.equal(queued!.attemptCount, 0, "new purge queue attempt count mismatch");

      // A repeated cascade with the same opaque request ID must not duplicate
      // or replace the original deletion instruction.
      const second = await boundary("insert_second_account", () =>
        insertOnboardedUser(db!, secondSuffix, "male", false, false),
      );
      const duplicate = await boundary("begin_duplicate_identity_request", () => identityRepository.begin(
        second.userId,
        "didit-v3",
        IDENTITY_BIOMETRIC_CONSENT_VERSION,
        new Date(),
      ));
      phase = "assert_duplicate_identity_request_created";
      assert.ok(duplicate);
      const duplicateProviderReference = randomUUID();
      queueIds.push(duplicate!.requestId);
      phase = "bind_duplicate_provider_reference";
      assert.equal(await boundary("bind_duplicate_provider_reference", () =>
        identityRepository.bindProviderReference(duplicate!, duplicateProviderReference)),
      true, "duplicate provider reference binding must succeed");
      const [rekeyed] = await boundary("rekey_duplicate_identity_request", () => db!
        .update(identityVerifications)
        .set({ requestId: pending!.requestId })
        .where(eq(identityVerifications.requestId, duplicate!.requestId))
        .returning({ requestId: identityVerifications.requestId }));
      phase = "assert_duplicate_request_rekeyed";
      assert.ok(rekeyed?.requestId === pending!.requestId, "duplicate identity request was not rekeyed");
      await boundary("delete_second_account", () => db!.delete(users).where(eq(users.id, second.userId)));
      const duplicateQueueRows = await boundary("read_duplicate_queue_rows", () => db!
        .select()
        .from(identityProviderPurgeQueue)
        .where(eq(identityProviderPurgeQueue.requestId, pending!.requestId)));
      phase = "assert_duplicate_queue_count";
      assert.equal(duplicateQueueRows.length, 1, "duplicate purge request must remain unique");
      phase = "assert_original_provider_reference_preserved";
      assert.ok(duplicateQueueRows[0]?.providerReference === providerReference, "original provider reference must be preserved");

      const retryStartedAt = Date.now();
      await boundary("mark_provider_purge_retry", () => identityProviderPurgeQueueRepository.markProviderPurgeRetry({
        requestId: pending!.requestId,
        provider: "didit-v3",
        providerReference,
      }));
      const [retried] = await boundary("read_retried_purge_row", () => db!
        .select()
        .from(identityProviderPurgeQueue)
        .where(eq(identityProviderPurgeQueue.requestId, pending!.requestId)));
      phase = "assert_retry_attempt_count";
      assert.equal(retried?.attemptCount, 1, "retry attempt count mismatch");
      const retryDelayMs = (retried?.nextAttemptAt.getTime() ?? 0) - retryStartedAt;
      phase = "assert_retry_delay";
      assert.ok(retryDelayMs >= 50_000 && retryDelayMs <= 90_000, "retry delay is outside configured bounds");
      phase = "assert_retry_not_due";
      assert.equal(
        (await boundary("list_not_due_provider_purges", () => identityProviderPurgeQueueRepository.listProviderPurges(100))).some(
          (entry) => entry.requestId === pending!.requestId,
        ),
        false,
        "future retry must not be returned as due",
      );

      const dueFixtures = Array.from({ length: 51 }, () => ({
        requestId: randomUUID(),
        provider: "didit-v3",
        providerReference: randomUUID(),
      }));
      queueIds.push(...dueFixtures.map((entry) => entry.requestId));
      await boundary("insert_due_queue_fixtures", () => db!.insert(identityProviderPurgeQueue).values(dueFixtures));
      const boundedDue = await boundary("list_bounded_due_provider_purges", () => identityProviderPurgeQueueRepository.listProviderPurges(100));
      phase = "assert_due_queue_limit";
      assert.equal(boundedDue.length, 50, "provider purge query must enforce row limit");

      await observeIntegrationCase("identity_provider_purge_queue_account_deletion", async () => {
        assert.equal(duplicateQueueRows.length, 1, "duplicate purge request must remain unique");
        assert.equal(retried?.attemptCount, 1, "retry attempt count mismatch");
        assert.equal(boundedDue.length, 50, "provider purge query must enforce row limit");
      });
    } catch (error) {
      failure = {
        phase,
        name: safeErrorName(error),
        code: safeErrorCode(error),
        operator:
          typeof (error as { operator?: unknown } | null)?.operator === "string"
            ? (error as { operator: string }).operator
            : null,
      };
      console.error(JSON.stringify({
        event: "integration.db_unlock_failure",
        phase: failure.phase,
        error_name: failure.name,
        error_code: failure.code,
        assertion_operator: failure.operator,
      }));
    } finally {
      if (db) {
        try {
          await boundary("cleanup_synthetic_users", () => db!.delete(users).where(inArray(users.id, userIds)));
        } catch {
          cleanupFailed = true;
        }
        if (queueIds.length > 0) {
          try {
            await boundary("cleanup_synthetic_queue_rows", () => db!
              .delete(identityProviderPurgeQueue)
              .where(inArray(identityProviderPurgeQueue.requestId, queueIds)));
          } catch {
            cleanupFailed = true;
          }
        }
      }
    }

    if (cleanupFailed) {
      console.error(JSON.stringify({ event: "integration.db_unlock_cleanup", outcome: "FAIL" }));
      if (!failure) failure = { phase: "cleanup", name: "CleanupError", code: null, operator: null };
    }
    if (failure) throw new Error(`db-unlock purge test failed at ${failure.phase} (${failure.name})`);
  });

  it("profile eligibility, direct access, revision binding and deletion fail closed", async () => {
    const url = getIntegrationDatabaseUrl();
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
      const pending = await identityRepository.begin(b.userId, "test-only", IDENTITY_BIOMETRIC_CONSENT_VERSION, new Date());
      assert.ok(pending);
      await profileBasicsRepository.save(b.userId, { ...input, age: 24 });
      assert.equal(await identityRepository.markVerifiedUnpurged(pending!, {
        requestId: pending!.requestId,
        providerReference: "33333333-3333-4333-8333-333333333333",
        verifiedAt: new Date(),
        documentVerified: true,
        livenessVerified: true,
        faceMatchVerified: true,
        deviceIpVerified: true,
        adultVerified: true,
      }, new Date()), false);
      const fresh = await identityRepository.begin(b.userId, "test-only", IDENTITY_BIOMETRIC_CONSENT_VERSION, new Date());
      assert.ok(fresh);
      assert.equal(await identityRepository.find(a.userId, fresh.requestId), null);
      const freshProviderReference = randomUUID();
      assert.equal(
        await identityRepository.bindProviderReference(fresh!, freshProviderReference),
        true,
        "fresh provider reference binding must succeed",
      );
      const boundFresh = await identityRepository.find(b.userId, fresh!.requestId);
      assert.ok(boundFresh, "bound identity request must be readable");
      assert.equal(await identityRepository.markVerifiedUnpurged(boundFresh!, {
        requestId: fresh!.requestId,
        providerReference: freshProviderReference,
        verifiedAt: new Date(),
        documentVerified: true,
        livenessVerified: true,
        faceMatchVerified: true,
        deviceIpVerified: true,
        adultVerified: true,
      }, new Date()), true, "current bound identity request must accept complete proof");
      assert.equal(await identityRepository.markVerified(boundFresh!, new Date()), true);
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
