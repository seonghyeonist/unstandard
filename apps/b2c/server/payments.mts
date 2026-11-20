import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Database, Transaction } from "../db/client.mts";
import { jobs, members, orders, paymentEvents, paymentRateLimits, recoveryTokens, rooms } from "../db/schema.mts";
import {
  cents, currency, sku, validPayment, uuidPattern, type Adjustment, type Clock, type Locale,
  type OrderReference, type Payment, type PaymentEvent, type PaymentProvider,
} from "./payment-provider.mts";
import { digestToken, entitlementExpiresAt, issueSession, roomLifetimeMs } from "./session.mts";

const minute = 60_000;
export const purchaseLifetime = 60 * minute;
export const recoveryLifetime = 15 * minute;
const recoveryEmail = /^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/;
export function normalizeEmail(email: string) {
  const value = email.trim().toLowerCase();
  return value.length <= 254 && recoveryEmail.test(value) ? value : null;
}

export class PaymentError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export type MailSink = (message: { id: string; to: string; url: string }) => Promise<void>;

type Order = typeof orders.$inferSelect;
type Effects = { payment?: Payment; adjustments?: Adjustment[] };

async function lockOrder(tx: Transaction, orderId: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  return order;
}

function ownerProof(order: Order, owner: string, now: Date) {
  if (order.purchaseDigest !== owner || !order.purchaseExpiresAt ||
    order.purchaseExpiresAt <= now || order.purchaseRevokedAt) throw new PaymentError(404, "not_found");
}

export function createPayments(db: Database, provider: PaymentProvider, key: string, origin: string,
  clock: Clock = () => new Date()) {
  const keyed = (purpose: string, value: string) =>
    createHmac("sha256", key).update(purpose).update("\0").update(value);
  const hash = (purpose: string, value: string) => keyed(purpose, value).digest("hex");
  const recoveryValue = (id: string) => keyed("recovery-token", id).digest("base64url");
  const matches = (order: Order | undefined): order is Order => !!order && order.paymentMode === provider.mode &&
    order.priceId === provider.priceId && order.sku === sku && order.usdCents === cents && order.currency === currency;

  async function consumeRate(scope: string, subject: string, limit: number, interval: number) {
    const now = clock();
    const expiresAt = new Date(now.getTime() + interval);
    const [row] = await db.insert(paymentRateLimits).values({
      key: hash(scope, subject), count: 1, expiresAt,
    }).onConflictDoUpdate({
      target: paymentRateLimits.key,
      set: {
        count: sql`case when ${paymentRateLimits.expiresAt} <= ${now.toISOString()} then 1
          else least(${paymentRateLimits.count} + 1, ${limit + 1}) end`,
        expiresAt: sql`case when ${paymentRateLimits.expiresAt} <= ${now.toISOString()} then
          ${expiresAt.toISOString()}::timestamptz else ${paymentRateLimits.expiresAt} end`,
      },
    }).returning({ count: paymentRateLimits.count });
    if (row.count > limit) throw new PaymentError(429, "rate_limit");
  }

  async function bind(order: OrderReference, payment: Payment) {
    if (payment.orderId !== order.id || payment.priceId !== provider.priceId ||
      payment.quantity !== 1 || payment.currency !== currency) {
      throw new PaymentError(409, "transaction_mismatch");
    }
    await db.transaction(async (tx) => {
      const current = await lockOrder(tx, order.id);
      if (!matches(current) || (current.providerTx && current.providerTx !== payment.id)) {
        throw new PaymentError(409, "transaction_mismatch");
      }
      await tx.update(orders).set({ providerTx: payment.id }).where(eq(orders.id, order.id));
    });
    return payment.id;
  }

  async function createOrder(requestKey: string, owner: string, locale: Locale) {
    const { order, shouldCreate } = await db.transaction(async (tx) => {
      const now = clock();
      const [inserted] = await tx.insert(orders).values({
        requestKey, sku, usdCents: cents, currency, priceId: provider.priceId,
        paymentMode: provider.mode, checkoutLocale: locale, purchaseDigest: owner,
        purchaseExpiresAt: new Date(now.getTime() + purchaseLifetime), createdAt: now,
      }).onConflictDoNothing({ target: orders.requestKey }).returning();
      const [order] = inserted ? [inserted] : await tx.select().from(orders)
        .where(eq(orders.requestKey, requestKey)).for("update");
      if (!matches(order)) throw new PaymentError(404, "not_found");
      ownerProof(order, owner, now);
      if (order.checkoutLocale !== locale || order.state !== "pending") throw new PaymentError(409, "checkout_conflict");
      const shouldCreate = !order.providerTx && !order.checkoutAttemptAt;
      if (shouldCreate) await tx.update(orders).set({ checkoutAttemptAt: now }).where(eq(orders.id, order.id));
      return { order, shouldCreate };
    });

    let transactionId = order.providerTx;
    if (shouldCreate) {
      try {
        await provider.validateCatalog();
      } catch {
        // Catalog lookup happens before any external create, so this reservation can be retried.
        await db.update(orders).set({ checkoutAttemptAt: null })
          .where(and(eq(orders.id, order.id), isNull(orders.providerTx)));
        throw new PaymentError(503, "catalog_unavailable");
      }
      // Reserve the attempt before the outbound call. Never blindly repeat an ambiguous Paddle create.
      transactionId = await bind(order, await provider.createTransaction(order));
    }
    return { id: order.id, transactionId, created: shouldCreate };
  }

  async function apply(tx: Transaction, order: Order, effects: Effects) {
    const now = clock();
    const { payment, adjustments = [] } = effects;
    if (payment && (payment.id !== order.providerTx || !validPayment(payment, order.id, order.priceId))) {
      throw new PaymentError(422, "transaction_mismatch");
    }
    if (adjustments.some((a) => a.transactionId !== order.providerTx || a.currency !== currency)) {
      throw new PaymentError(422, "adjustment_mismatch");
    }
    const dispute = adjustments.some((a) => ["chargeback", "chargeback_warning"].includes(a.action) &&
      !["rejected", "reversed"].includes(a.status));
    const fullRefund = adjustments.some((a) => a.action === "refund" && a.status === "approved" && a.type === "full");
    const partial = adjustments.some((a) => a.action === "refund" && a.status === "approved" && a.type !== "full");
    const review = partial && !order.paymentReview ? "partial_refund" : order.paymentReview;

    if (dispute || fullRefund) {
      const state = dispute || order.state === "disputed" ? "disputed" : "refunded";
      await tx.update(orders).set({ state, purchaseRevokedAt: order.purchaseRevokedAt ?? now, paymentReview: review })
        .where(eq(orders.id, order.id));
      await tx.update(rooms).set({ revokedAt: now }).where(and(eq(rooms.orderId, order.id), isNull(rooms.revokedAt)));
      await tx.update(recoveryTokens).set({ revokedAt: now })
        .where(and(eq(recoveryTokens.orderId, order.id), isNull(recoveryTokens.revokedAt)));
      return;
    }
    if (order.state === "refunded" || order.state === "disputed") return;
    if (review !== order.paymentReview) await tx.update(orders).set({ paymentReview: review }).where(eq(orders.id, order.id));
    if (!payment || payment.status !== "completed") return;
    if (!payment.paidAt || !Number.isFinite(payment.paidAt.getTime()) ||
      payment.paidAt.getTime() > now.getTime() + minute || payment.paidAt.getTime() < order.createdAt.getTime() - minute ||
      !payment.customerId) throw new PaymentError(422, "invalid_settlement");
    if (order.state === "paid") return;

    await tx.update(orders).set({ state: "paid", paidAt: payment.paidAt, customerId: payment.customerId })
      .where(eq(orders.id, order.id));
    const [room] = await tx.insert(rooms).values({
      orderId: order.id, expiresAt: new Date(payment.paidAt.getTime() + roomLifetimeMs),
    }).returning({ id: rooms.id });
    await tx.insert(members).values({ roomId: room.id, role: "buyer", locale: order.checkoutLocale ?? "en" });
    await tx.insert(jobs).values([{ orderId: order.id, kind: "personal_card" }, { orderId: order.id, kind: "index_payment_email" }]);
  }

  async function ingest(event: PaymentEvent) {
    const payment = "payment" in event ? event.payment : undefined;
    const adjustment = "adjustment" in event ? event.adjustment : undefined;
    if (!event.id || !Number.isFinite(event.occurredAt.getTime()) ||
      (payment && (event.type !== "transaction.completed" || payment.status !== "completed")) ||
      (adjustment && !["adjustment.created", "adjustment.updated"].includes(event.type))) {
      throw new PaymentError(422, "invalid_event");
    }
    const providerTx = payment?.id ?? adjustment?.transactionId;
    if (!providerTx) throw new PaymentError(422, "invalid_event");
    await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.providerTx, providerTx)).for("update");
      if (!matches(order)) {
        if (payment?.orderId && uuidPattern.test(payment.orderId)) {
          const pending = await lockOrder(tx, payment.orderId);
          if (matches(pending) && pending.checkoutAttemptAt && !pending.providerTx) {
            throw new PaymentError(503, "transaction_binding_pending");
          }
        }
        throw new PaymentError(422, "transaction_mismatch");
      }
      const [recorded] = await tx.insert(paymentEvents).values({
        id: event.id, type: event.type, providerTx, orderId: order.id, occurredAt: event.occurredAt,
      }).onConflictDoNothing().returning({ id: paymentEvents.id });
      if (recorded) await apply(tx, order, { payment, adjustments: adjustment ? [adjustment] : [] });
    });
  }

  async function activeBuyer(tx: Transaction, order: Order) {
    const [owner] = await tx.select({ memberId: members.id, roomId: rooms.id, expiresAt: rooms.expiresAt })
      .from(rooms).innerJoin(members, eq(members.roomId, rooms.id))
      .where(and(eq(rooms.orderId, order.id), eq(members.role, "buyer"),
        isNull(rooms.revokedAt), isNull(members.revokedAt)));
    return order.state === "paid" && order.paidAt && owner &&
      entitlementExpiresAt(order.paidAt, owner.expiresAt) > clock() ? owner : null;
  }

  async function rotateProof(current: string, next: string) {
    const now = clock();
    const moved = await db.update(orders).set({ purchaseDigest: next })
      .where(and(eq(orders.purchaseDigest, current), isNull(orders.purchaseRevokedAt),
        gt(orders.purchaseExpiresAt, now), eq(orders.paymentMode, provider.mode))).returning({ id: orders.id });
    if (moved.length === 0) throw new PaymentError(409, "no_active_purchase_proof");
  }

  async function claim(orderId: string, owner: string) {
    return db.transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      if (!matches(order)) throw new PaymentError(404, "not_found");
      ownerProof(order, owner, clock());
      if (order.state === "pending") return { status: 202 as const };
      const buyer = await activeBuyer(tx, order);
      if (!buyer) throw new PaymentError(410, "inactive_order");
      const cookie = await issueSession(tx, buyer.memberId, clock);
      await tx.update(orders).set({ purchaseRevokedAt: clock(), purchaseDigest: null }).where(eq(orders.id, order.id));
      return { status: 200 as const, cookie, roomId: buyer.roomId };
    });
  }

  async function requestRecovery(email: string) {
    const emailDigest = hash("email", email);
    await consumeRate("recovery-email", emailDigest, 3, recoveryLifetime);
    const earliest = new Date(+clock() - roomLifetimeMs);
    await db.transaction(async (tx) => {
      const candidates = await tx.select().from(orders).where(and(eq(orders.emailDigest, emailDigest),
        eq(orders.paymentMode, provider.mode), eq(orders.state, "paid"), gt(orders.paidAt, earliest)))
        .orderBy(sql`${orders.id} asc`).limit(10).for("update");
      for (const order of candidates) {
        if (!matches(order) || !await activeBuyer(tx, order)) continue;
        const now = clock();
        const [open] = await tx.select({ id: recoveryTokens.id }).from(recoveryTokens)
          .where(and(eq(recoveryTokens.orderId, order.id), gt(recoveryTokens.expiresAt, now),
            isNull(recoveryTokens.usedAt), isNull(recoveryTokens.revokedAt))).limit(1);
        if (open) continue;
        const id = randomUUID();
        const digest = digestToken(recoveryValue(id));
        await tx.insert(recoveryTokens).values({ id, digest, orderId: order.id,
          expiresAt: new Date(now.getTime() + recoveryLifetime) });
        // Per-order revisions stay unique. The order row serializes recovery token creation.
        const [max] = await tx.select({ revision: sql<number>`coalesce(max(${jobs.revision}), 0)` }).from(jobs)
          .where(and(eq(jobs.orderId, order.id), eq(jobs.kind, "recovery_mail")));
        await tx.insert(jobs).values({ orderId: order.id, kind: "recovery_mail", revision: max.revision + 1, payload: { id } });
      }
    });
  }

  async function recover(value: string) {
    const digest = digestToken(value);
    return db.transaction(async (tx) => {
      const [hint] = await tx.select({ orderId: recoveryTokens.orderId }).from(recoveryTokens)
        .where(eq(recoveryTokens.digest, digest));
      if (!hint) throw new PaymentError(404, "not_found");
      const order = await lockOrder(tx, hint.orderId);
      if (!matches(order)) throw new PaymentError(404, "not_found");
      const now = clock();
      const [used] = await tx.update(recoveryTokens).set({ usedAt: now })
        .where(and(eq(recoveryTokens.digest, digest), gt(recoveryTokens.expiresAt, now),
          isNull(recoveryTokens.usedAt), isNull(recoveryTokens.revokedAt))).returning();
      const buyer = await activeBuyer(tx, order);
      if (!used || !buyer) throw new PaymentError(404, "not_found");
      const cookie = await issueSession(tx, buyer.memberId, clock);
      await tx.update(orders).set({ purchaseRevokedAt: now, purchaseDigest: null }).where(eq(orders.id, order.id));
      return { cookie, roomId: buyer.roomId };
    });
  }

  async function reconcile(orderId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!matches(order) || !order.checkoutAttemptAt) return;
    let transactionId = order.providerTx;
    if (!transactionId) {
      const candidate = await provider.findTransaction(order);
      if (!candidate) throw new Error("Payment binding requires reconciliation");
      transactionId = await bind(order, candidate);
    }
    const [payment, adjustments] = await Promise.all([
      provider.getTransaction(transactionId), provider.getAdjustments(transactionId),
    ]);
    const stillPending = await db.transaction(async (tx) => {
      const latest = await lockOrder(tx, orderId);
      if (!matches(latest)) throw new PaymentError(422, "transaction_mismatch");
      await apply(tx, latest, { payment: payment.status === "completed" ? payment : undefined, adjustments });
      const [current] = await tx.select({ state: orders.state }).from(orders).where(eq(orders.id, orderId));
      return current.state === "pending" && payment.status !== "canceled";
    });
    if (stillPending) throw new Error("Payment is still pending");
  }

  async function indexEmail(orderId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!matches(order) || order.state !== "paid" || !order.customerId) return;
    const email = normalizeEmail(await provider.getCustomerEmail(order.customerId));
    if (!email) throw new Error("Invalid provider email");
    await db.update(orders).set({ emailDigest: hash("email", email) })
      .where(and(eq(orders.id, order.id), eq(orders.state, "paid"), eq(orders.customerId, order.customerId)));
  }

  async function sendRecovery(orderId: string, id: string, send: MailSink) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!matches(order) || !order.customerId) return;
    const email = normalizeEmail(await provider.getCustomerEmail(order.customerId));
    if (!email || hash("email", email) !== order.emailDigest) throw new Error("Settlement email changed");
    const allowed = await db.transaction(async (tx) => {
      const current = await lockOrder(tx, orderId);
      if (!matches(current) || current.emailDigest !== order.emailDigest || !await activeBuyer(tx, current)) return false;
      const [token] = await tx.select().from(recoveryTokens)
        .where(and(eq(recoveryTokens.id, id), eq(recoveryTokens.orderId, orderId),
          gt(recoveryTokens.expiresAt, clock()), isNull(recoveryTokens.usedAt), isNull(recoveryTokens.revokedAt)));
      return !!token;
    });
    if (allowed) await send({ id, to: email, url: `${origin}/recover#token=${recoveryValue(id)}` });
  }

  return { provider, consumeRate, createOrder, ingest, rotateProof, claim, requestRecovery, recover,
    reconcile, indexEmail, sendRecovery, clock };
}

export type Payments = ReturnType<typeof createPayments>;
export const purchaseCookieName = "__Host-b2c_purchase";
export const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export function purchaseToken() { return randomBytes(32).toString("base64url"); }
export function purchaseCookie(value: string) {
  return `${purchaseCookieName}=${value}; Path=/; Max-Age=${purchaseLifetime / 1000}; Secure; HttpOnly; SameSite=Lax`;
}
export function proofDigest(header: string | undefined) {
  const values = header?.split(";").map((part) => part.trim()).filter((part) => part.startsWith(purchaseCookieName + "="));
  const value = values?.length === 1 ? values[0].slice(purchaseCookieName.length + 1) : "";
  return tokenPattern.test(value) ? digestToken(value) : null;
}
