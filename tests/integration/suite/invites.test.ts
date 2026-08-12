import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import { createIntegrationDb, getIntegrationDatabaseUrl } from "../helpers";
import { runDrizzleMigrations } from "../../../lib/db/run-migrations";
import { alphaInvites } from "../../../lib/db/schema/invites";
import { users } from "../../../lib/db/schema/auth";
import { profiles } from "../../../lib/db/schema/profiles";
import {
  consumeReservedInvite,
  releaseStaleReservedInvites,
  reserveInviteForEmail,
  verifyInviteReservation,
} from "../../../lib/auth/invite-gate";
import {
  finalizeInviteRegistration,
  isUserInviteFinalized,
} from "../../../lib/auth/invite-finalization";
import {
  generateInviteCode,
  hashInviteCode,
  normalizeEmail,
} from "../../../lib/auth/invite-crypto";
import { createRegistrationTicket, verifyRegistrationTicket } from "../../../lib/auth/invite-ticket";
import { observeIntegrationCase } from "../../../lib/readiness/integration-case-log";
import { extractPgErrorCode } from "../../../lib/db/errors";

const PEPPER = "integration-test-pepper";
const AUTH_SECRET = "integration-test-auth-secret-32chars";

async function insertAuthUser(db: ReturnType<typeof createIntegrationDb>, suffix: string) {
  const userId = `user-${suffix}`;
  await db.insert(users).values({
    id: userId,
    name: `Invite User ${suffix}`,
    email: `${suffix}@example.com`,
    emailVerified: true,
  });
  return userId;
}

describe("integration: invite reservation lifecycle", () => {
  it("legacy_invite_excluded_from_stage1", async () => {
    process.env.ALPHA_INVITE_PEPPER = PEPPER;
    const url = getIntegrationDatabaseUrl();
    await runDrizzleMigrations(url);
    const db = createIntegrationDb(url);
    const rawCode = generateInviteCode();
    const email = `legacy-invite-${Date.now()}@example.com`;

    const [legacy] = await db
      .insert(alphaInvites)
      .values({
        emailNormalized: normalizeEmail(email),
        codeHash: hashInviteCode(rawCode, PEPPER),
        status: "pending",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        targetPhase: "legacy_pre_stage1",
      })
      .returning({ id: alphaInvites.id });

    await observeIntegrationCase("legacy_invite_excluded_from_stage1", async () => {
      assert.deepEqual(await reserveInviteForEmail(rawCode, email), {
        ok: false,
        code: "INVALID",
      });
      const active = await db.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count
        FROM alpha_invites
        WHERE id = ${legacy.id} AND target_phase = 'alpha_stage_1'
      `);
      assert.equal(Number(active.rows[0]?.count), 0);
    });

    await db.delete(alphaInvites).where(eq(alphaInvites.id, legacy.id));
  });

  it("alpha_stage1_capacity_concurrency", async () => {
    const url = getIntegrationDatabaseUrl();
    await runDrizzleMigrations(url);
    const db = createIntegrationDb(url);
    const marker = `capacity-${Date.now()}`;

    await observeIntegrationCase("alpha_stage1_capacity_concurrency", async () => {
      const observed = await db.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count
        FROM alpha_invites
        WHERE target_phase = 'alpha_stage_1'
          AND (status = 'consumed' OR (status IN ('pending', 'reserved') AND expires_at > now()))
      `);
      const active = Number(observed.rows[0]?.count ?? 0);
      assert.ok(active < 50, "test branch must start below the Stage 1 cap");

      for (let index = active; index < 49; index += 1) {
        await db.insert(alphaInvites).values({
          emailNormalized: `${marker}-${index}@example.com`,
          codeHash: hashInviteCode(`${marker}-${index}`, PEPPER),
          status: "pending",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
      }

      const attempts = await Promise.allSettled([
        db.insert(alphaInvites).values({
          emailNormalized: `${marker}-race-a@example.com`,
          codeHash: hashInviteCode(`${marker}-race-a`, PEPPER),
          status: "pending",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }),
        db.insert(alphaInvites).values({
          emailNormalized: `${marker}-race-b@example.com`,
          codeHash: hashInviteCode(`${marker}-race-b`, PEPPER),
          status: "pending",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }),
      ]);
      assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
      const rejection = attempts.find((attempt) => attempt.status === "rejected");
      assert.equal(rejection?.status, "rejected");
      if (rejection?.status === "rejected") {
        assert.equal(extractPgErrorCode(rejection.reason), "23514");
      }

      const final = await db.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count
        FROM alpha_invites
        WHERE target_phase = 'alpha_stage_1'
          AND (status = 'consumed' OR (status IN ('pending', 'reserved') AND expires_at > now()))
      `);
      assert.equal(Number(final.rows[0]?.count), 50);
    });

    await db.execute(sql`DELETE FROM alpha_invites WHERE email_normalized LIKE ${`${marker}%`}`);
  });

  it("invite_concurrency", async () => {
    process.env.ALPHA_INVITE_PEPPER = PEPPER;
    const url = getIntegrationDatabaseUrl();
    await runDrizzleMigrations(url);
    const db = createIntegrationDb(url);

    const rawCode = generateInviteCode();
    const email = `invite-concurrency-${Date.now()}@example.com`;
    const emailNormalized = normalizeEmail(email);

    await db.insert(alphaInvites).values({
      emailNormalized,
      codeHash: hashInviteCode(rawCode, PEPPER),
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await observeIntegrationCase("invite_concurrency", async () => {
      const [first, second] = await Promise.all([
        reserveInviteForEmail(rawCode, email),
        reserveInviteForEmail(rawCode, email),
      ]);

      const successes = [first, second].filter((result) => result.ok);
      assert.equal(successes.length, 1);
    });
  });

  it("invite_consumed_by_user_fk", async () => {
    process.env.ALPHA_INVITE_PEPPER = PEPPER;
    process.env.BETTER_AUTH_SECRET = AUTH_SECRET;
    const url = getIntegrationDatabaseUrl();
    const db = createIntegrationDb(url);

    const rawCode = generateInviteCode();
    const email = `invite-replay-${Date.now()}@example.com`;
    const suffix = `${Date.now()}`;

    await db.insert(alphaInvites).values({
      emailNormalized: normalizeEmail(email),
      codeHash: hashInviteCode(rawCode, PEPPER),
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const reserved = await reserveInviteForEmail(rawCode, email);
    assert.equal(reserved.ok, true);
    if (!reserved.ok) return;

    const ticket = createRegistrationTicket(
      reserved.inviteId,
      reserved.email,
      reserved.reservationCapability,
      AUTH_SECRET,
    );
    const parsed = verifyRegistrationTicket(ticket.token, AUTH_SECRET);
    assert.ok(parsed);
    assert.equal(await verifyInviteReservation(parsed!), true);

    const userId = await insertAuthUser(db, suffix);

    await observeIntegrationCase("invite_consumed_by_user_fk", async () => {
      const firstConsume = await consumeReservedInvite(
        reserved.inviteId,
        userId,
        reserved.reservationCapability,
        db,
      );
      assert.equal(firstConsume.ok, true);

      const [consumedRow] = await db
        .select({ consumedByUserId: alphaInvites.consumedByUserId, status: alphaInvites.status })
        .from(alphaInvites)
        .where(eq(alphaInvites.id, reserved.inviteId))
        .limit(1);
      assert.equal(consumedRow?.status, "consumed");
      assert.equal(consumedRow?.consumedByUserId, userId);

      const replay = await consumeReservedInvite(
        reserved.inviteId,
        `other-${userId}`,
        reserved.reservationCapability,
        db,
      );
      assert.equal(replay.ok, false);
    });
  });

  it("releases stale reservations", async () => {
    process.env.ALPHA_INVITE_PEPPER = PEPPER;
    const url = getIntegrationDatabaseUrl();
    const db = createIntegrationDb(url);

    const [staleInvite] = await db
      .insert(alphaInvites)
      .values({
        emailNormalized: normalizeEmail(`stale-${Date.now()}@example.com`),
        codeHash: hashInviteCode(generateInviteCode(), PEPPER),
        status: "reserved",
        reservedAt: new Date(Date.now() - 30 * 60 * 1000),
        reservationNonceHash: "stale-hash",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning({ id: alphaInvites.id });

    const released = await releaseStaleReservedInvites();
    assert.ok(released >= 1);

    const [releasedRow] = await db
      .select({ status: alphaInvites.status, reservationNonceHash: alphaInvites.reservationNonceHash })
      .from(alphaInvites)
      .where(eq(alphaInvites.id, staleInvite.id))
      .limit(1);

    assert.equal(releasedRow?.status, "pending");
    assert.equal(releasedRow?.reservationNonceHash, null);
  });
});

describe("integration: invite finalization transaction", () => {
  it("invite_finalization_success", async () => {
    process.env.ALPHA_INVITE_PEPPER = PEPPER;
    delete process.env.UNSTANDARD_TEST_INJECT_FINALIZE_FAILURE;

    const url = getIntegrationDatabaseUrl();
    await runDrizzleMigrations(url);
    const db = createIntegrationDb(url);
    const suffix = `finalize-success-${Date.now()}`;
    const rawCode = generateInviteCode();
    const email = `${suffix}@example.com`;

    await db.insert(alphaInvites).values({
      emailNormalized: normalizeEmail(email),
      codeHash: hashInviteCode(rawCode, PEPPER),
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const reserved = await reserveInviteForEmail(rawCode, email);
    assert.equal(reserved.ok, true);
    if (!reserved.ok) return;

    const userId = await insertAuthUser(db, suffix);

    await observeIntegrationCase("invite_finalization_success", async () => {
      await finalizeInviteRegistration({
        inviteId: reserved.inviteId,
        userId,
        reservationCapability: reserved.reservationCapability,
        email,
      });

      assert.equal(await isUserInviteFinalized(userId, db), true);
      const [profile] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);
      assert.ok(profile?.id);

      const [invite] = await db
        .select({ status: alphaInvites.status, consumedByUserId: alphaInvites.consumedByUserId })
        .from(alphaInvites)
        .where(eq(alphaInvites.id, reserved.inviteId))
        .limit(1);
      assert.equal(invite?.status, "consumed");
      assert.equal(invite?.consumedByUserId, userId);
    });
  });

  it("invite_finalization_rollback (consume inject)", async () => {
    process.env.ALPHA_INVITE_PEPPER = PEPPER;
    process.env.UNSTANDARD_TEST_INJECT_FINALIZE_FAILURE = "consume";

    const url = getIntegrationDatabaseUrl();
    const db = createIntegrationDb(url);
    const suffix = `finalize-consume-fail-${Date.now()}`;
    const rawCode = generateInviteCode();
    const email = `${suffix}@example.com`;

    await db.insert(alphaInvites).values({
      emailNormalized: normalizeEmail(email),
      codeHash: hashInviteCode(rawCode, PEPPER),
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const reserved = await reserveInviteForEmail(rawCode, email);
    assert.equal(reserved.ok, true);
    if (!reserved.ok) return;

    const userId = await insertAuthUser(db, suffix);

    await observeIntegrationCase("invite_finalization_rollback", async () => {
      await assert.rejects(() =>
        finalizeInviteRegistration({
          inviteId: reserved.inviteId,
          userId,
          reservationCapability: reserved.reservationCapability,
          email,
        }),
      );

      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
      assert.equal(user, undefined);
    });
  });

  it("rolls back consumed invite when finalize update is injected to fail", async () => {
    process.env.ALPHA_INVITE_PEPPER = PEPPER;
    process.env.UNSTANDARD_TEST_INJECT_FINALIZE_FAILURE = "finalize";

    const url = getIntegrationDatabaseUrl();
    const db = createIntegrationDb(url);
    const suffix = `finalize-rollback-${Date.now()}`;
    const rawCode = generateInviteCode();
    const email = `${suffix}@example.com`;

    await db.insert(alphaInvites).values({
      emailNormalized: normalizeEmail(email),
      codeHash: hashInviteCode(rawCode, PEPPER),
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const reserved = await reserveInviteForEmail(rawCode, email);
    assert.equal(reserved.ok, true);
    if (!reserved.ok) return;

    const userId = await insertAuthUser(db, suffix);
    await assert.rejects(() =>
      finalizeInviteRegistration({
        inviteId: reserved.inviteId,
        userId,
        reservationCapability: reserved.reservationCapability,
        email,
      }),
    );

    const [invite] = await db
      .select({ status: alphaInvites.status })
      .from(alphaInvites)
      .where(eq(alphaInvites.id, reserved.inviteId))
      .limit(1);
    assert.equal(invite?.status, "reserved");

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    assert.equal(user, undefined);
  });

  it("rolls back consumed invite when profile bootstrap is injected to fail", async () => {
    process.env.ALPHA_INVITE_PEPPER = PEPPER;
    process.env.UNSTANDARD_TEST_INJECT_FINALIZE_FAILURE = "profile";

    const url = getIntegrationDatabaseUrl();
    const db = createIntegrationDb(url);
    const suffix = `finalize-profile-fail-${Date.now()}`;
    const rawCode = generateInviteCode();
    const email = `${suffix}@example.com`;

    await db.insert(alphaInvites).values({
      emailNormalized: normalizeEmail(email),
      codeHash: hashInviteCode(rawCode, PEPPER),
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const reserved = await reserveInviteForEmail(rawCode, email);
    assert.equal(reserved.ok, true);
    if (!reserved.ok) return;

    const userId = await insertAuthUser(db, suffix);
    await assert.rejects(() =>
      finalizeInviteRegistration({
        inviteId: reserved.inviteId,
        userId,
        reservationCapability: reserved.reservationCapability,
        email,
      }),
    );

    const [invite] = await db
      .select({ status: alphaInvites.status })
      .from(alphaInvites)
      .where(eq(alphaInvites.id, reserved.inviteId))
      .limit(1);
    assert.equal(invite?.status, "reserved");
  });
});
