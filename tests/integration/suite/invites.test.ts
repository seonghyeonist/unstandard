import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { createIntegrationDb, getIntegrationDatabaseUrl } from "../helpers";
import { runDrizzleMigrations } from "../../../lib/db/run-migrations";
import { alphaInvites } from "../../../lib/db/schema/invites";
import {
  consumeReservedInvite,
  releaseStaleReservedInvites,
  reserveInviteForEmail,
  verifyInviteReservation,
} from "../../../lib/auth/invite-gate";
import {
  generateInviteCode,
  hashInviteCode,
  normalizeEmail,
} from "../../../lib/auth/invite-crypto";
import { createRegistrationTicket, verifyRegistrationTicket } from "../../../lib/auth/invite-ticket";

const PEPPER = "integration-test-pepper";
const AUTH_SECRET = "integration-test-auth-secret-32chars";

describe("integration: invite reservation lifecycle", () => {
  it("allows exactly one concurrent reservation", async () => {
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

    const [first, second] = await Promise.all([
      reserveInviteForEmail(rawCode, email),
      reserveInviteForEmail(rawCode, email),
    ]);

    const successes = [first, second].filter((result) => result.ok);
    assert.equal(successes.length, 1);
  });

  it("rejects consume replay and stale reservation release", async () => {
    process.env.ALPHA_INVITE_PEPPER = PEPPER;
    process.env.BETTER_AUTH_SECRET = AUTH_SECRET;
    const url = getIntegrationDatabaseUrl();
    const db = createIntegrationDb(url);

    const rawCode = generateInviteCode();
    const email = `invite-replay-${Date.now()}@example.com`;

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

    const userId = `user-${Date.now()}`;
    const firstConsume = await consumeReservedInvite(
      reserved.inviteId,
      userId,
      reserved.reservationCapability,
    );
    assert.equal(firstConsume.ok, true);

    const replay = await consumeReservedInvite(
      reserved.inviteId,
      `other-${userId}`,
      reserved.reservationCapability,
    );
    assert.equal(replay.ok, false);

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
