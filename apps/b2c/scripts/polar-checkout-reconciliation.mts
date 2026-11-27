import type { PolarSandboxProvider } from "../server/polar-provider.mts";
import { Blocked } from "./sandbox-helpers.mts";

const pageSize = 100;
const pageLimit = 20;

type Page<T> = { items: T[]; pagination: { total_count: number; max_page: number } };

async function readAll<T extends { id: string }>(load: (page: number, limit: number) => Promise<Page<T>>) {
  const rows = new Map<string, T>();
  let expected: Page<T>["pagination"] | undefined;
  for (let page = 1; page <= pageLimit; page++) {
    const { items, pagination } = await load(page, pageSize);
    const { total_count: total, max_page: pages } = pagination;
    if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(pages) || pages < 0 ||
        pages > pageLimit || (total === 0 ? pages > 1 : pages !== Math.ceil(total / pageSize)) ||
        (expected && (expected.total_count !== total || expected.max_page !== pages)) ||
        items.length !== Math.min(pageSize, Math.max(0, total - (page - 1) * pageSize))) {
      throw new Blocked("sandbox_reconciliation_pagination_unverified");
    }
    expected = pagination;
    for (const item of items) {
      if (typeof item.id !== "string" || item.id.length === 0 || rows.has(item.id)) {
        throw new Blocked("sandbox_reconciliation_record_unverified");
      }
      rows.set(item.id, item);
    }
    if (page >= pages) return rows;
  }
  throw new Blocked("sandbox_reconciliation_page_limit");
}

type Client = Pick<PolarSandboxProvider["client"], "checkouts" | "orders" | "refunds" | "payments">;

export async function reconcileSandboxHistory(
  client: Client, organizationId: string, productId: string, expectedCheckoutId?: string,
) {
  const scope = { organization_id: organizationId, product_id: productId };
  const checkouts = await readAll((page, limit) => client.checkouts.list({
    ...scope, sorting: ["-created_at"], page, limit,
  }));
  const latest = checkouts.values().next().value;
  const exact = expectedCheckoutId ? await client.checkouts.get(expectedCheckoutId) : latest;
  if ([...checkouts.values(), ...(exact ? [exact] : [])].some((checkout) =>
    checkout.organization_id !== organizationId || checkout.product_id !== productId)) {
    throw new Blocked("sandbox_reconciliation_checkout_scope_unverified");
  }
  const matches = exact?.id === latest?.id && (!expectedCheckoutId || exact?.id === expectedCheckoutId) &&
    (!latest || (exact?.status === latest.status && exact.expires_at === latest.expires_at));
  const orders = await readAll((page, limit) => client.orders.list({ ...scope, page, limit }));
  const orderCounts = new Map<string, number>();
  const refundedOrders = new Set<string>();
  let unresolvedOrders = 0;
  for (const order of orders.values()) {
    const checkout = order.checkout_id ? checkouts.get(order.checkout_id) : undefined;
    if (checkout) orderCounts.set(checkout.id, (orderCounts.get(checkout.id) ?? 0) + 1);
    if (!checkout || order.product_id !== productId ||
        typeof checkout.metadata.b2c_order_id !== "string" ||
        checkout.metadata.b2c_order_id !== order.metadata.b2c_order_id ||
        order.currency.toUpperCase() !== "USD" || order.net_amount !== 899 ||
        !Number.isSafeInteger(order.tax_amount) || order.tax_amount < 0 ||
        (!order.paid && String(order.status) !== "refunded")) {
      unresolvedOrders++;
      continue;
    }
    const refunds = [...(await readAll((page, limit) => client.refunds.list({ order_id: order.id, page, limit }))).values()];
    if (refunds.length > 0 && refunds.every((refund) =>
      refund.order_id === order.id && refund.status === "succeeded" &&
      Number.isSafeInteger(refund.amount) && refund.amount > 0 &&
      Number.isSafeInteger(refund.tax_amount) && refund.tax_amount >= 0) &&
      refunds.reduce((total, refund) => total + refund.amount, 0) === order.net_amount &&
      refunds.reduce((total, refund) => total + refund.tax_amount, 0) === order.tax_amount) {
      refundedOrders.add(order.id);
    } else {
      unresolvedOrders++;
    }
  }
  const duplicateCheckouts = [...orderCounts.values()].filter((count) => count > 1).length;
  const refundedCheckouts = new Set([...orders.values()]
    .filter((order) => refundedOrders.has(order.id)).map((order) => order.checkout_id));
  const unresolvedCheckouts = [...checkouts.values()].filter((checkout) =>
    checkout.status !== "failed" && checkout.status !== "expired" &&
    (checkout.status !== "succeeded" || !refundedCheckouts.has(checkout.id))).length;
  const exactOrder = exact ? [...orders.values()].filter((order) => order.checkout_id === exact.id) : [];
  const summary = {
    ...(exact ? {
      checkout_id: exact.id, checkout_created_utc: new Date(exact.created_at).toISOString(),
      checkout_expires_utc: new Date(exact.expires_at).toISOString(),
    } : {}),
    checkout_status: exact?.status ?? "absent",
    order_state: exactOrder.length === 0 ? "absent" :
      exactOrder.length === 1 && refundedOrders.has(exactOrder[0].id) ? "fully_refunded" : "requires_reconciliation",
    expected_checkout_matches_latest: matches,
    scanned_checkouts: checkouts.size, scanned_orders: orders.size,
    unresolved_checkouts: unresolvedCheckouts, unresolved_orders: unresolvedOrders, duplicate_checkouts: duplicateCheckouts,
  };
  let pending = 0;
  let unresolved = 0;
  let attempts = 0;
  const paidCheckouts = new Set<string>();
  try {
    const payments = await readAll((page, limit) => client.payments.list({ organization_id: organizationId, page, limit }));
    for (const payment of payments.values()) {
      const order = payment.order_id ? orders.get(payment.order_id) : undefined;
      const checkoutId = payment.checkout_id ?? order?.checkout_id;
      const relevant = Boolean(order || (checkoutId && checkouts.has(checkoutId)));
      if (payment.status === "pending") pending++;
      if (!relevant) continue;
      attempts++;
      if (payment.status === "failed") continue;
      if (payment.status !== "succeeded" || !order || !checkoutId || order.checkout_id !== checkoutId ||
          !refundedOrders.has(order.id) || paidCheckouts.has(checkoutId)) {
        unresolved++;
      } else {
        paidCheckouts.add(checkoutId);
      }
    }
  } catch (error) {
    const status = error && typeof error === "object" && "statusCode" in error ? error.statusCode : undefined;
    return { ...summary, payment_attempts: "unverified", payment_read_http_status:
      typeof status === "number" && status >= 400 && status <= 599 ? status : undefined, ready_for_rehearsal: false };
  }
  return {
    ...summary, payment_attempts: attempts, pending_org_payments: pending, unresolved_payments: unresolved,
    ready_for_rehearsal: matches && unresolvedCheckouts === 0 && unresolvedOrders === 0 &&
      duplicateCheckouts === 0 && pending === 0 && unresolved === 0,
  };
}
