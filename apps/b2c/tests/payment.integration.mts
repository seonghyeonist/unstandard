import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { connectDatabase, databaseTarget, type Database } from "../db/client.mts";
import { jobs, members, orders, paymentEvents, recoveryTokens, rooms, sessions } from "../db/schema.mts";
import { createAppServer } from "../server/http.mts";
import { createPaymentHandler } from "../server/payment-http.mts";
import { signFixture, sku, SyntheticPaymentProvider, type Adjustment, type PaymentEvent } from "../server/payment-provider.mts";
import { runPaymentJobs } from "../server/payment-worker.mts";
import { createPayments, type MailSink } from "../server/payments.mts";
import { createRepository } from "../server/repository.mts";

if (!databaseTarget().local || process.env.B2C_DB_FIXTURES !== "disposable-loopback") {
  throw new Error("Payment integration tests require the disposable loopback runner");
}
const { db, pool } = connectDatabase();
const secret = "synthetic fixture signature key";
const platform = "/webhooks/paddle";
const card = "/me/card";
const path = "/api/b2c";

function fixture() {
  let now = new Date("2026-11-20T00:00:00Z");
  const clock = () => now;
  const provider = new SyntheticPaymentProvider(secret, clock);
  const payment = createPayments(db, provider, "synthetic token key", "http://localhost", clock);
  return { provider, payment, clock, advance: (minutes: number) => { now = new Date(+now + minutes * 60_000); } };
}

const servers = new Set<ReturnType<typeof createAppServer>>();
before(async () => {
  // A deferred constraint trigger turns the fixture's selected event into a real commit-time error.
  await db.execute(sql`
    create function b2c.fixture_fail_event_commit() returns trigger language plpgsql as $$
    begin
      if NEW.event_id like 'commit-fault-%' then raise exception 'fixture_commit_failure'; end if;
      return NEW;
    end;
    $$;
    create constraint trigger fixture_commit_fault after insert on b2c.payment_events
      deferrable initially deferred for each row execute function b2c.fixture_fail_event_commit();
  `);
});
after(async () => {
  await Promise.all([...servers].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await pool.end();
});

async function app(f: ReturnType<typeof fixture>, payment = f.payment, fixedIp = false) {
  const origin = "http://localhost";
  const server = createAppServer(createRepository(db, f.clock), origin, {
    payment: createPaymentHandler(payment, origin,
      (req) => fixedIp ? "127.0.0.1" : req.headers["x-test-ip"]?.toString()),
    clientToken: "test_fixture",
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  servers.add(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server unavailable");
  const { port } = address;
  let ip = 1;
  async function call(route: string, value?: unknown, options: { cookie?: string; origin?: string; signature?: string;
    key?: string; raw?: string; ip?: string } = {}) {
    const reply = await fetch(`http://127.0.0.1:${port}${path}${route}`, {
      method: value === undefined && options.raw === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json", Origin: options.origin ?? origin,
        "X-Test-IP": options.ip ?? `127.0.0.${ip++}`,
        ...(options.cookie ? { Cookie: options.cookie } : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
        ...(options.signature ? { "Paddle-Signature": options.signature } : {}),
      },
      body: options.raw ?? (value === undefined ? undefined : JSON.stringify(value)),
    });
    return { status: reply.status, body: await reply.json(), cookie: reply.headers.get("set-cookie")?.split(";")[0],
      headers: reply.headers };
  }
  async function browser() {
    const boot = await call("/purchase-proof", {});
    assert.equal(boot.status, 200);
    assert.ok(boot.cookie);
    return boot.cookie;
  }
  async function order(cookie?: string, key = randomUUID()) {
    const proof = cookie ?? await browser();
    const result = await call("/orders", { sku, locale: "ko" }, { cookie: proof, key });
    assert.equal(result.status, 201);
    const { orderId, transactionId } = result.body;
    return { orderId: String(orderId), transactionId: String(transactionId), proof, key };
  }
  function postEvent(event: PaymentEvent, rawSignature?: string) {
    const raw = JSON.stringify(event);
    return call(platform, undefined, { raw, signature: rawSignature ?? signFixture(raw, secret, f.clock()) });
  }
  async function completed(orderId: string, transactionId: string) {
    const customerId = randomUUID();
    f.provider.emails.set(customerId, `${customerId}@example.test`);
    const payment = { ...await f.provider.getTransaction(transactionId), orderId, customerId,
      paidAt: f.clock(), status: "completed" };
    f.provider.transactions.set(transactionId, payment);
    return { id: randomUUID(), type: "transaction.completed", occurredAt: f.clock(), payment };
  }
  return { call, browser, order, postEvent, completed };
}

function adjustment(f: ReturnType<typeof fixture>, transactionId: string, override: Partial<Adjustment> = {}) {
  return { id: randomUUID(), type: "adjustment.updated", occurredAt: f.clock(),
    adjustment: { transactionId, action: "refund", status: "approved", type: "full", currency: "USD", ...override } };
}

test("order ownership, idempotency, concurrent checkout and claim, exact 14-day room", async () => {
  const f = fixture();
  const api = await app(f);
  const proof = await api.browser();
  const key = randomUUID();
  const body = { sku, locale: "ko" };
  assert.equal((await api.call("/orders", { ...body, amount: 1 }, { cookie: proof, key })).status, 422);
  const attempts = await Promise.all(Array.from({ length: 5 }, () => api.call("/orders", body, { cookie: proof, key })));
  assert.equal(attempts.filter((result) => result.status === 201).length, 1);
  assert.ok(attempts.every((result) => [201, 202, 200].includes(result.status)));
  assert.equal(f.provider.transactions.size, 1);
  const { orderId, transactionId } = attempts.find((result) => result.status === 201)?.body;
  assert.equal((await api.call("/orders", body, { cookie: await api.browser(), key })).status, 404);
  assert.equal((await api.call("/orders/claim", { orderId }, { cookie: proof })).status, 202);
  assert.equal((await api.call(card, undefined, { cookie: proof })).status, 401);

  const rotated = await api.call("/purchase-proof/rotate", {}, { cookie: proof });
  assert.equal(rotated.status, 200);
  assert.ok(rotated.cookie);
  assert.equal((await api.call("/orders/claim", { orderId }, { cookie: proof })).status, 404);
  assert.equal((await api.call("/orders/claim", { orderId }, { cookie: rotated.cookie })).status, 202);
  const event = await api.completed(orderId, transactionId);
  const deliveries = await Promise.all(Array.from({ length: 6 }, () => api.postEvent(event)));
  assert.ok(deliveries.every((result) => result.status === 200));
  assert.equal((await db.select().from(paymentEvents).where(eq(paymentEvents.orderId, orderId))).length, 1);
  assert.equal((await db.select().from(jobs).where(eq(jobs.orderId, orderId))).filter((job) => job.kind === "personal_card").length, 1);
  const [room] = await db.select().from(rooms).where(eq(rooms.orderId, orderId));
  assert.equal(+room.expiresAt - +event.payment.paidAt, 14 * 86_400_000);
  assert.equal((await api.call("/orders/claim", { orderId }, { cookie: await api.browser() })).status, 404);
  const claims = await Promise.all(Array.from({ length: 4 }, () => api.call("/orders/claim", { orderId }, { cookie: rotated.cookie })));
  assert.deepEqual(claims.map((result) => result.status).sort(), [200, 404, 404, 404]);
  const [buyer] = await db.select().from(members).where(eq(members.roomId, room.id));
  assert.equal((await db.select().from(sessions).where(eq(sessions.memberId, buyer.id))).length, 1);
  const session = claims.find((result) => result.status === 200)?.cookie;
  const ready = await api.call(card, undefined, { cookie: session });
  assert.equal(ready.status, 202);
  assert.equal(ready.headers.get("cache-control"), "no-store");
  assert.equal(ready.headers.get("referrer-policy"), "no-referrer");
  f.advance(14 * 24 * 60);
  assert.equal((await api.call(card, undefined, { cookie: session })).status, 410);
});

test("defensive checks reject missing/stale signature, another order, changed line items and invalid Origin", async () => {
  const f = fixture();
  const api = await app(f);
  const a = await api.order();
  const b = await api.order();
  const event = await api.completed(a.orderId, a.transactionId);
  assert.equal((await api.call(platform, event)).status, 401);
  const original = JSON.stringify(event);
  assert.equal((await api.call(platform, undefined, { raw: original,
    signature: signFixture(original, secret, new Date(+f.clock() - 60_000)) })).status, 401);
  assert.equal((await api.postEvent(event, signFixture(original, "unrecognized fixture secret", f.clock()))).status, 401);
  assert.equal((await api.call(platform, undefined, { raw: original + " ", signature: signFixture(original, secret, f.clock()) })).status, 401);
  const variants = [{ id: b.transactionId }, { priceId: "other" }, { quantity: 2 }, { currency: "EUR" }, { unitSubtotal: "898" }];
  for (const variant of variants) {
    assert.equal((await api.postEvent({ ...event, payment: { ...event.payment, ...variant } })).status, 422);
  }
  assert.equal((await api.call("/orders/claim", { orderId: a.orderId }, { cookie: a.proof, origin: "https://example.test" })).status, 403);
  assert.equal((await api.call("/orders/claim", { orderId: a.orderId }, { cookie: a.proof })).status, 202);
  assert.equal((await db.select().from(paymentEvents).where(eq(paymentEvents.orderId, a.orderId))).length, 0);
});

test("refund first stays revoked, partial refund is reviewed, disputes and refunds revoke issued sessions", async () => {
  const f = fixture();
  const api = await app(f);
  const first = await api.order();
  const complete = await api.completed(first.orderId, first.transactionId);
  assert.equal((await api.postEvent(adjustment(f, first.transactionId))).status, 200);
  assert.equal((await api.postEvent(complete)).status, 200);
  assert.equal((await db.select().from(rooms).where(eq(rooms.orderId, first.orderId))).length, 0);

  for (const action of ["refund", "chargeback"]) {
    const current = await api.order();
    const event = await api.completed(current.orderId, current.transactionId);
    assert.equal((await api.postEvent(event)).status, 200);
    const session = await api.call("/orders/claim", { orderId: current.orderId }, { cookie: current.proof });
    assert.equal(session.status, 200);
    assert.equal((await api.postEvent(adjustment(f, current.transactionId, { type: "partial" }))).status, 200);
    assert.equal((await db.select().from(orders).where(eq(orders.id, current.orderId)))[0].paymentReview, "partial_refund");
    assert.equal((await api.call(card, undefined, { cookie: session.cookie })).status, 202);
    assert.equal((await api.postEvent(adjustment(f, current.transactionId, { action }))).status, 200);
    assert.equal((await api.postEvent({ ...event, id: randomUUID() })).status, 200);
    assert.equal((await api.call(card, undefined, { cookie: session.cookie })).status, 410);
  }
});

test("commit failure rolls back ledger and access, then the same event can be retried", async () => {
  const f = fixture();
  const api = await app(f);
  const order = await api.order();
  const event = { ...await api.completed(order.orderId, order.transactionId), id: "commit-fault-" + randomUUID() };
  assert.equal((await api.postEvent(event)).status, 503);
  assert.equal((await db.select().from(paymentEvents).where(eq(paymentEvents.id, event.id))).length, 0);
  assert.equal((await db.select().from(rooms).where(eq(rooms.orderId, order.orderId))).length, 0);
  assert.equal((await db.select().from(jobs).where(eq(jobs.orderId, order.orderId))).length, 0);
  await db.execute(sql`drop trigger fixture_commit_fault on b2c.payment_events`);
  assert.equal((await api.postEvent(event)).status, 200);
  assert.equal((await db.select().from(rooms).where(eq(rooms.orderId, order.orderId))).length, 1);
});

test("recovery is generic, digest-only, expiring, revocable and consumed once under concurrency", async () => {
  const f = fixture();
  const api = await app(f);
  const order = await api.order();
  const event = await api.completed(order.orderId, order.transactionId);
  assert.equal((await api.postEvent(event)).status, 200);
  const outbox = new Map<string, string>();
  const sink: MailSink = async (message) => { outbox.set(message.id, message.url); };
  await f.payment.indexEmail(order.orderId);
  const email = await f.provider.getCustomerEmail(event.payment.customerId);
  async function requestLink() {
    const result = await api.call("/recovery/request", { email });
    assert.equal(result.status, 202);
    assert.deepEqual(result.body, (await api.call("/recovery/request", { email: `${randomUUID()}@example.test` })).body);
    // Exercise lease and idempotency for the specific fixture's queued recovery messages.
    const queued = (await db.select().from(recoveryTokens).where(eq(recoveryTokens.orderId, order.orderId))).at(-1);
    assert.ok(queued);
    await f.payment.sendRecovery(order.orderId, queued.id, sink);
    const url = outbox.get(queued.id);
    assert.ok(url);
    const token = new URLSearchParams(new URL(url).hash.slice(1)).get("token");
    assert.ok(token);
    assert.notEqual(queued.digest, token);
    return token;
  }
  const expired = await requestLink();
  f.advance(15);
  assert.equal((await api.call("/recovery/claim", { token: expired })).status, 404);
  const token = await requestLink();
  const attempts = await Promise.all(Array.from({ length: 3 }, () => api.call("/recovery/claim", { token })));
  assert.deepEqual(attempts.map((result) => result.status).sort(), [200, 404, 404]);
  const cookie = attempts.find((result) => result.status === 200)?.cookie;
  assert.equal((await api.call(card, undefined, { cookie })).status, 202);
  const revoked = await requestLink();
  assert.equal((await api.postEvent(adjustment(f, order.transactionId))).status, 200);
  assert.equal((await api.call("/recovery/claim", { token: revoked })).status, 404);
  assert.equal((await api.call(card, undefined, { cookie })).status, 410);
});

test("reconciliation recovers an ambiguous create and observed adjustments; lease failures are bounded", async () => {
  const f = fixture();
  const api = await app(f);
  const proof = await api.browser();
  const key = randomUUID();
  const original = f.provider.createTransaction.bind(f.provider);
  f.provider.createTransaction = async (reference) => { await original(reference); throw new Error("synthetic upstream timeout"); };
  assert.equal((await api.call("/orders", { sku, locale: "en" }, { cookie: proof, key })).status, 503);
  const pending = await api.call("/orders", { sku, locale: "en" }, { cookie: proof, key });
  assert.equal(pending.status, 202);
  assert.equal(f.provider.transactions.size, 1);
  const transactionId = [...f.provider.transactions.keys()][0];
  const event = await api.completed(pending.body.orderId, transactionId);
  f.provider.adjustments.set(transactionId, [adjustment(f, transactionId).adjustment]);
  f.advance(5);
  await f.payment.reconcile(pending.body.orderId);
  const [order] = await db.select().from(orders).where(eq(orders.id, pending.body.orderId));
  assert.equal(order.providerTx, transactionId);
  assert.equal(order.state, "refunded");
  assert.equal((await api.postEvent(event)).status, 200);
  assert.equal((await db.select().from(rooms).where(eq(rooms.orderId, order.id))).length, 0);

  f.provider.createTransaction = original;
  const retry = await api.order();
  f.advance(5);
  const ready = await api.completed(retry.orderId, retry.transactionId);
  const get = f.provider.getTransaction.bind(f.provider);
  f.provider.getTransaction = async () => { throw new Error("synthetic read failure"); };
  const noMail: MailSink = async () => {};
  await Promise.all([runPaymentJobs(db, f.payment, noMail), runPaymentJobs(db, f.payment, noMail)]);
  const retryJob = async () => (await db.select().from(jobs).where(eq(jobs.orderId, retry.orderId)))
    .find((job) => job.kind === "reconcile_payment");
  assert.equal((await retryJob())?.attempts, 1);
  f.advance(5);
  f.provider.getTransaction = get;
  await runPaymentJobs(db, f.payment, noMail);
  assert.equal((await retryJob())?.attempts, 2);
  assert.ok((await retryJob())?.finishedAt);
  assert.equal((await db.select().from(orders).where(eq(orders.id, retry.orderId)))[0].state, "paid");
  assert.ok(ready.payment.paidAt);
});

test("rate limit storage failure fails closed before any order attempt", async () => {
  const f = fixture();
  const failingDb = new Proxy(db, {
    get(target, property, receiver) {
      if (property === "insert") return () => { throw new Error("synthetic storage fault"); };
      return Reflect.get(target, property, receiver);
    },
  }) as Database;
  const api = await app(f, createPayments(failingDb, f.provider, "fixture", "http://localhost", f.clock), true);
  assert.equal((await api.call("/purchase-proof", {})).status, 503);
  assert.equal(f.provider.transactions.size, 0);
});
