import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import { after, before, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { connectDatabase, databaseTarget } from "../db/client.mts";
import { cards, invites, members, orders, paymentEvents, rooms, rounds, sessions, submissions } from "../db/schema.mts";
import { createAppServer } from "../server/http.mts";
import { createRepository } from "../server/repository.mts";
import { cookieName, digestToken, issueSession, revokeSession, roomLifetimeMs } from "../server/session.mts";

const target = databaseTarget();
if (!target.local || process.env.B2C_DB_FIXTURES !== "disposable-loopback") {
  throw new Error("Integration fixtures require the disposable loopback database runner");
}
const {db, pool} = connectDatabase();
const paidAt = new Date("2026-11-19T00:00:00Z");
let now = paidAt;
const clock = () => now;
const origin = "http://127.0.0.1:4173";
const server = createAppServer(createRepository(db, clock), origin);

before(async () => {
  const result = await db.execute(sql`select count(*)::int as count from b2c_migration.__drizzle_migrations`);
  const {entries} = JSON.parse(await readFile(new URL("../db/migrations/meta/_journal.json", import.meta.url), "utf8"));
  assert.equal(result.rows[0].count, entries.length, "each migration must be applied once across both runs");
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
});

after(async () => {
  if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

function call(path: string, cookie?: string, body?: unknown, requestOrigin: string | null = origin) {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server unavailable");
  return new Promise<{status?: number; cache?: string; referrer?: string; body: Record<string, unknown>}>((resolve, reject) => {
    const req = request({
      hostname: address.address,
      port: address.port,
      method: body === undefined ? "GET" : "PATCH",
      path,
      headers: {
        ...(cookie ? {Cookie: cookie} : {}),
        ...(body === undefined ? {} : {"Content-Type": "application/json"}),
        ...(requestOrigin ? {Origin: requestOrigin} : {}),
      },
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({
        status: res.statusCode,
        cache: res.headers["cache-control"],
        referrer: res.headers["referrer-policy"]?.toString(),
        body: JSON.parse(data),
      }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

async function fixture() {
  now = paidAt;
  return db.transaction(async (tx) => {
    const providerTx = "txn_fixture_" + randomUUID();
    const [order] = await tx.insert(orders).values({
      requestKey: randomUUID(), sku: "reconnect", usdCents: 899, priceId: "pri_fixture", providerTx,
      state: "paid", paidAt,
    }).returning({id: orders.id});
    const [room] = await tx.insert(rooms).values({
      orderId: order.id, expiresAt: new Date(paidAt.getTime() + roomLifetimeMs),
    }).returning({id: rooms.id});
    const [buyer, partner] = await tx.insert(members).values([
      {roomId: room.id, role: "buyer", locale: "en"},
      {roomId: room.id, role: "partner", locale: "ko"},
    ]).returning({id: members.id});
    const issued = await issueSession(tx, buyer.id, clock);
    const partnerIssued = await issueSession(tx, partner.id, clock);
    assert.match(issued, /^__Host-b2c_session=[\w-]{43}; Path=\/; Max-Age=\d+; Secure; HttpOnly; SameSite=Lax$/);
    return {roomId: room.id, buyer: buyer.id, partner: partner.id, orderId: order.id, providerTx,
      cookie: issued.split(";")[0], partnerCookie: partnerIssued.split(";")[0]};
  });
}

function databaseCode(expected: string) {
  return (error: unknown) => error instanceof Error && error.cause instanceof Error &&
    "code" in error.cause && error.cause.code === expected;
}

test("session digest storage and own room or personal card checks", async () => {
  const a = await fixture();
  const b = await fixture();
  const token = a.cookie.slice(cookieName.length + 1);
  const [saved] = await db.select().from(sessions).where(eq(sessions.memberId, a.buyer));
  assert.equal(saved.digest, digestToken(token));
  const path = "/api/b2c/rooms/" + a.roomId;
  assert.equal((await call(path)).status, 401);
  const own = await call(path, a.cookie);
  assert.equal(own.status, 200);
  assert.equal(own.cache, "no-store");
  assert.equal(own.referrer, "no-referrer");
  assert.deepEqual(own.body.member, {role: "buyer", locale: "en", revision: 0});
  assert.equal((await call(path, b.cookie)).status, 404);
  assert.equal((await call(path + "/me", b.cookie, {locale: "ko", revision: 0})).status, 404);
  await db.insert(cards).values({
    roomId: a.roomId, ownerMemberId: a.buyer, kind: "personal", revision: 0,
    payload: {text: "synthetic buyer card"},
  });
  assert.deepEqual((await call("/api/b2c/me/card", a.cookie)).body,
    {revision: 0, payload: {text: "synthetic buyer card"}});
  for (const other of [a.partnerCookie, b.cookie]) {
    const response = await call("/api/b2c/me/card", other);
    assert.equal(response.status, 202);
    assert.deepEqual(response.body, {state: "pending"});
  }
});

test("authenticated locale writes enforce origin, input contract and revision under concurrency", async () => {
  const f = await fixture();
  const path = "/api/b2c/rooms/" + f.roomId + "/me";
  const valid = {locale: "ko", revision: 0};
  assert.equal((await call(path, f.cookie, valid, null)).status, 403);
  assert.equal((await call(path, f.cookie, valid, "https://different.example")).status, 403);
  assert.equal((await call(path, f.cookie, {...valid, memberId: f.partner})).status, 422);
  const writes = await Promise.all([call(path, f.cookie, valid), call(path, f.cookie, valid)]);
  assert.deepEqual(writes.map((x) => x.status).sort(), [200, 409]);
  const [owner] = await db.select().from(members).where(eq(members.id, f.buyer));
  const [partner] = await db.select().from(members).where(eq(members.id, f.partner));
  assert.equal(owner.revision, 1);
  assert.equal(owner.locale, "ko");
  assert.equal(partner.revision, 0);
});

test("invalidated sessions, members and entitlements stop reads and writes", async () => {
  const f = await fixture();
  const path = "/api/b2c/rooms/" + f.roomId;
  const token = f.cookie.slice(cookieName.length + 1);
  const digest = digestToken(token);
  await db.transaction((tx) => revokeSession(tx, digest, now));
  assert.equal((await call(path, f.cookie)).status, 401);
  assert.equal((await call(path + "/me", f.cookie, {locale: "ko", revision: 0})).status, 401);
  await db.update(members).set({revokedAt: now}).where(eq(members.id, f.partner));
  assert.equal((await call(path, f.partnerCookie)).status, 401);

  const g = await fixture();
  const secondPath = "/api/b2c/rooms/" + g.roomId;
  await db.update(rooms).set({revokedAt: now}).where(eq(rooms.id, g.roomId));
  assert.equal((await call(secondPath, g.cookie)).status, 410);
  assert.equal((await call(secondPath + "/me", g.cookie, {locale: "ko", revision: 0})).status, 410);
  await db.update(rooms).set({revokedAt: null}).where(eq(rooms.id, g.roomId));
  await db.update(orders).set({state: "refunded"}).where(eq(orders.id, g.orderId));
  assert.equal((await call("/api/b2c/me/card", g.cookie)).status, 410);
  await assert.rejects(db.transaction((tx) => issueSession(tx, g.buyer, clock)), /Inactive B2C membership/);
});

test("14-day boundary applies even if the persisted room expiration is later", async () => {
  const f = await fixture();
  const path = "/api/b2c/rooms/" + f.roomId;
  await db.update(rooms).set({expiresAt: new Date(paidAt.getTime() + 2 * roomLifetimeMs)}).where(eq(rooms.id, f.roomId));
  now = new Date(paidAt.getTime() + roomLifetimeMs - 1);
  assert.equal((await call(path, f.cookie)).status, 200);
  now = new Date(now.getTime() + 1);
  assert.equal((await call(path, f.cookie)).status, 410);
  assert.equal((await call(path + "/me", f.cookie, {locale: "ko", revision: 0})).status, 410);
  now = new Date(paidAt.getTime() + 15 * 24 * 60 * 60 * 1_000);
  assert.equal((await call(path, f.cookie)).status, 401);
});

test("PostgreSQL enforces room references and collapses duplicate events and active invites", async () => {
  const a = await fixture();
  const b = await fixture();
  const event = {id: "evt_fixture_" + randomUUID(), type: "transaction.completed",
    providerTx: a.providerTx, orderId: a.orderId, occurredAt: now};
  const inserts = await Promise.allSettled([
    db.insert(paymentEvents).values(event), db.insert(paymentEvents).values(event),
  ]);
  assert.equal(inserts.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(inserts.filter((r) => r.status === "rejected" && databaseCode("23505")(r.reason)).length, 1);
  await db.insert(invites).values({digest: digestToken("first fixture invite"), roomId: a.roomId, expiresAt: now});
  await assert.rejects(db.insert(invites).values({
    digest: digestToken("second fixture invite"), roomId: a.roomId, expiresAt: now,
  }), databaseCode("23505"));
  const [round] = await db.insert(rounds).values({
    roomId: a.roomId, deadline: now, slots: [{id: "s1", startsAt: now.toISOString(), endsAt: now.toISOString()}],
  }).returning({id: rounds.id});
  await assert.rejects(db.insert(submissions).values({
    roomId: a.roomId, roundId: round.id, memberId: b.buyer, tuples: [],
  }), databaseCode("23503"));
  await assert.rejects(db.insert(cards).values({
    roomId: a.roomId, ownerMemberId: b.buyer, kind: "personal", revision: 0, payload: {},
  }), databaseCode("23503"));
});
