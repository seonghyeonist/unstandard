import assert from "node:assert/strict";
import test from "node:test";
import { reconcileSandboxHistory } from "../scripts/polar-checkout-reconciliation.mts";

const org = "sandbox-org";
const product = "p2-product";
const checkout = (id: string, status = "expired") => ({
  id, status, organization_id: org, product_id: product, metadata: { b2c_order_id: "app-" + id },
  created_at: "2026-11-27T04:55:32Z", expires_at: "2026-11-28T04:55:32Z",
});
const order = (id = "order") => ({
  id, checkout_id: "expected", product_id: product, metadata: { b2c_order_id: "app-expected" },
  currency: "usd", net_amount: 899, tax_amount: 57, paid: true, status: "refunded",
});
const refund = (id: string, amount: number, tax_amount: number) => ({
  id, order_id: "order", amount, tax_amount, status: "succeeded",
});
const payment = (status: string, order_id?: string) => ({
  id: "payment", checkout_id: "expected", order_id, status,
});

function sandbox({
  sessions = [checkout("expected")], exact = sessions[0], orders = [] as ReturnType<typeof order>[],
  refunds = [] as ReturnType<typeof refund>[], payments = [] as ReturnType<typeof payment>[],
  paymentFailure, paymentReaderAnchor, mutatedPagination = false,
}: {
  sessions?: ReturnType<typeof checkout>[];
  exact?: ReturnType<typeof checkout>;
  orders?: ReturnType<typeof order>[];
  refunds?: ReturnType<typeof refund>[];
  payments?: ReturnType<typeof payment>[];
  paymentFailure?: number;
  paymentReaderAnchor?: ReturnType<typeof checkout> | 404;
  mutatedPagination?: boolean;
} = {}) {
  function list<T>(rows: T[], page: number, limit: number, mutates = false) {
    return { items: rows.slice((page - 1) * limit, page * limit), pagination: {
      total_count: rows.length + (mutates && page > 1 ? 1 : 0), max_page: Math.ceil(rows.length / limit),
    } };
  }
  type Query = { page: number; limit: number; organization_id?: string; product_id?: string };
  const scoped = ({ organization_id, product_id }: Query) => {
    assert.equal(organization_id, org);
    assert.equal(product_id, product);
  };
  const client = {
    checkouts: {
      list: async (query: Query) => { scoped(query); return list(sessions, query.page, query.limit, mutatedPagination); },
      get: async (id: string) => {
        assert.equal(id, "expected");
        if (!exact) throw Object.assign(new Error("private"), { statusCode: 404 });
        return exact;
      },
    },
    orders: { list: async (query: Query) => { scoped(query); return list(orders, query.page, query.limit); } },
    refunds: { list: async ({ order_id, page, limit }: Query & { order_id: string }) => {
      assert.ok(orders.some((entry) => entry.id === order_id));
      return list(refunds.filter((entry) => entry.order_id === order_id), page, limit);
    } },
    payments: { list: async ({ organization_id, page, limit }: Query) => {
      assert.equal(organization_id, org);
      if (paymentFailure) throw Object.assign(new Error("private"), { statusCode: paymentFailure });
      return list(payments, page, limit);
    } },
  };
  return () => reconcileSandboxHistory(client as unknown as Parameters<typeof reconcileSandboxHistory>[0],
    org, product, "expected",
    paymentReaderAnchor == null ? undefined : (async (id: string) => {
      assert.equal(id, "expected");
      if (paymentReaderAnchor === 404) throw Object.assign(new Error("private"), { statusCode: 404 });
      return paymentReaderAnchor;
    }) as unknown as Parameters<typeof reconcileSandboxHistory>[4]);
}

test("requires the exact prior checkout and checks earlier pages", async () => {
  assert.equal((await sandbox()()).ready_for_rehearsal, true);
  const sessions = [checkout("expected"), ...Array.from({ length: 99 }, (_, i) => checkout("old-" + i)),
    checkout("older-pending", "confirmed")];
  const history = await sandbox({ sessions })();
  assert.equal(history.scanned_checkouts, 101);
  assert.equal(history.unresolved_checkouts, 1);
  assert.equal(history.ready_for_rehearsal, false);
  assert.equal((await sandbox({ sessions: [checkout("new"), checkout("expected")], exact: checkout("expected") })())
    .ready_for_rehearsal, false);
  await assert.rejects(sandbox({ exact: { ...checkout("expected"), organization_id: "wrong" } })(),
    { message: "sandbox_reconciliation_checkout_scope_unverified" });
  await assert.rejects(sandbox({ sessions: [], exact: undefined })(), { statusCode: 404 });
  await assert.rejects(sandbox({ sessions, mutatedPagination: true })(),
    { message: "sandbox_reconciliation_pagination_unverified" });
});

test("blocks hidden payment history, pending attempts and payments without matching refunded orders", async () => {
  for (const code of [401, 403, 404]) {
    const state = await sandbox({ paymentFailure: code })();
    assert.equal(state.payment_attempts, "unverified");
    assert.equal(state.ready_for_rehearsal, false);
    assert.ok(JSON.stringify(state).includes(String(code)));
    assert.ok(!JSON.stringify(state).includes("private"));
  }
  for (const status of ["pending", "succeeded", "unknown"]) {
    assert.equal((await sandbox({ payments: [payment(status)] })()).ready_for_rehearsal, false);
  }
  assert.equal((await sandbox({ payments: [payment("failed")] })()).ready_for_rehearsal, true);
});

test("checks the exact Checkout with the separate payment-read token before trusting empty results", async () => {
  assert.equal((await sandbox({ paymentReaderAnchor: checkout("expected") })()).ready_for_rehearsal, true);
  for (const paymentReaderAnchor of [
    404 as const, checkout("wrong"), { ...checkout("expected"), organization_id: "wrong-org" },
    { ...checkout("expected"), product_id: "wrong-product" },
  ]) {
    const state = await sandbox({ paymentReaderAnchor })();
    assert.equal(state.payment_attempts, "unverified");
    assert.equal(state.ready_for_rehearsal, false);
  }
});

test("requires matching order, payment, and finalized principal plus tax refund", async () => {
  const sessions = [checkout("expected", "succeeded")];
  const orders = [order()];
  const payments = [payment("succeeded", "order")];
  const refunds = [refund("first", 500, 31), refund("second", 399, 26)];
  const resolved = { sessions, orders, payments, refunds };
  assert.equal((await sandbox(resolved)()).ready_for_rehearsal, true);
  for (const changes of [
    { orders: [{ ...order(), paid: false, status: "pending" }] },
    { orders: [{ ...order(), checkout_id: "unlisted" }] },
    { orders: [order(), order("duplicate")] },
    { refunds: [refund("partial", 500, 31)] },
    { refunds: [refund("wrong-tax", 899, 56)] },
    { refunds: [{ ...refund("pending", 899, 57), status: "pending" }] },
    { payments: [payments[0], { ...payments[0], id: "duplicate" }] },
  ]) {
    assert.equal((await sandbox({ ...resolved, ...changes })()).ready_for_rehearsal, false);
  }
});
