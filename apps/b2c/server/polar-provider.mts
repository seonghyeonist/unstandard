import { createPolar, webhooks, type models } from "@polar-sh/sdk/2026-10";
import { cents, currency, InvalidWebhook, uuidPattern, validPayment,
  type Adjustment, type OrderReference, type Payment, type PaymentProvider } from "./payment-provider.mts";

type Settings = { accessToken: string; organizationId: string; productId: string; webhookSecret: string; origin: string };
export const polarEvents = ["order.paid", "order.updated", "order.refunded", "refund.created", "refund.updated"] as const;

export function hostedSandboxCheckout(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.port || url.username || url.password ||
      !["sandbox.polar.sh", "buy.sandbox.polar.sh"].includes(url.hostname) ||
      !url.pathname.startsWith("/checkout/")) throw new Error("invalid_sandbox_checkout_url");
  return url.href;
}

export class PolarSandboxProvider implements PaymentProvider {
  readonly mode = "sandbox";
  get priceId() { return this.settings.productId; }
  readonly client;
  private readonly settings: Settings;

  constructor(settings: Settings) {
    if (!/^polar_oat_[a-z0-9_-]+$/i.test(settings.accessToken) ||
        !uuidPattern.test(settings.organizationId) || !uuidPattern.test(settings.productId) ||
        settings.webhookSecret.length < 24) throw new Error("invalid_polar_sandbox_config");
    this.settings = settings;
    this.client = createPolar({ accessToken: settings.accessToken, environment: "sandbox", timeout: 10 });
  }

  async validateCatalog() {
    const product = await this.client.products.get(this.priceId);
    const prices = product.prices.filter((price) => !price.is_archived);
    const [price] = prices;
    if (product.organization_id !== this.settings.organizationId || product.is_archived || product.is_recurring ||
        prices.length !== 1 || price.amount_type !== "fixed" || !("price_amount" in price) ||
        price.price_amount !== cents || price.price_currency.toUpperCase() !== currency ||
        price.tax_behavior === "inclusive") throw new Error("polar_catalog_mismatch");
  }

  private checkout(checkout: models.Checkout): Payment {
    if (checkout.organization_id !== this.settings.organizationId ||
        checkout.product_id !== this.priceId || checkout.amount !== cents ||
        checkout.discount_amount !== 0 || checkout.discount_id || checkout.subscription_id ||
        (checkout.units ?? 1) !== 1 || checkout.seats) throw new Error("polar_checkout_mismatch");
    const orderId = checkout.metadata.b2c_order_id;
    return {
      id: checkout.id, orderId: typeof orderId === "string" ? orderId : null,
      status: checkout.status === "expired" ? "canceled" : "draft",
      currency: checkout.currency.toUpperCase(), priceId: checkout.product_id, quantity: 1,
      unitSubtotal: String(checkout.amount), customerId: checkout.customer_id, paidAt: null,
      checkoutUrl: checkout.status === "open" ? hostedSandboxCheckout(checkout.url) : undefined,
    };
  }

  async createTransaction(order: OrderReference) {
    return this.checkout(await this.client.checkouts.create({
      products: [this.priceId], currency: "usd", allow_discount_codes: false, allow_trial: false,
      metadata: { b2c_order_id: order.id },
      success_url: this.settings.origin + "/checkout?return=1",
      return_url: this.settings.origin + "/checkout",
    }));
  }

  async checkoutUrl(id: string) {
    return this.checkout(await this.client.checkouts.get(id)).checkoutUrl;
  }

  async findTransaction(order: OrderReference) {
    const { items, pagination } = await this.client.checkouts.list({
      organization_id: this.settings.organizationId, product_id: this.priceId, sorting: ["-created_at"], limit: 100,
    });
    const latest = items.at(-1);
    if (pagination.max_page > 1 && (!latest || Date.parse(latest.created_at) >= +order.createdAt - 60_000)) {
      throw new Error("polar_checkout_reconciliation_incomplete");
    }
    const matches = items.filter((candidate) => candidate.metadata.b2c_order_id === order.id);
    if (matches.length > 1) throw new Error("polar_checkout_reconciliation_ambiguous");
    return matches[0] ? this.checkout(matches[0]) : null;
  }

  private async findOrder(id: string) {
    const { items } = await this.client.orders.list({
      organization_id: this.settings.organizationId, checkout_id: id, limit: 2,
    });
    if (items.length > 1) throw new Error("polar_order_ambiguous");
    return items[0];
  }

  private settledOrder(order: models.Order, checkout: models.Checkout, paidAt: Date): Payment {
    const payment = this.checkout(checkout);
    const [item] = order.items;
    if (order.checkout_id !== payment.id || order.product_id !== this.priceId ||
        order.metadata.b2c_order_id !== payment.orderId || order.billing_reason !== "purchase" ||
        order.subscription_id || order.discount_id || order.discount_amount !== 0 ||
        order.applied_balance_amount !== 0 || order.subtotal_amount !== cents || order.net_amount !== cents ||
        order.currency.toUpperCase() !== currency || (order.units ?? 1) !== 1 || order.seats ||
        order.items.length !== 1 || item.product_price_id !== checkout.product_price_id ||
        !item.product_price_id || item.amount !== cents || item.proration ||
        !payment.orderId || !validPayment(payment, payment.orderId, this.priceId)) throw new Error("polar_order_mismatch");
    return { ...payment, status: order.paid ? "completed" : "draft", customerId: order.customer_id,
      paidAt: order.paid ? paidAt : null };
  }

  async getTransaction(id: string) {
    const [checkout, order] = await Promise.all([this.client.checkouts.get(id), this.findOrder(id)]);
    return order ? this.settledOrder(order, checkout, new Date(order.created_at)) : this.checkout(checkout);
  }

  private async orderAdjustments(order: models.Order): Promise<Adjustment[]> {
    if (!order.checkout_id) return [];
    const transactionId = order.checkout_id;
    const orderId = typeof order.metadata.b2c_order_id === "string" ? order.metadata.b2c_order_id : undefined;
    const [disputes, refunds] = await Promise.all([
      this.client.disputes.list({ organization_id: this.settings.organizationId, order_id: order.id, limit: 100 }),
      this.client.refunds.list({ organization_id: this.settings.organizationId, order_id: order.id,
        succeeded: true, limit: 100 }),
    ]);
    if (disputes.pagination.max_page > 1 || refunds.pagination.max_page > 1) {
      throw new Error("polar_adjustment_reconciliation_incomplete");
    }
    if ([...disputes.items, ...refunds.items].some((item) => item.order_id !== order.id ||
        item.currency.toUpperCase() !== currency)) throw new Error("polar_adjustment_mismatch");
    if (disputes.items.some((item) => item.status !== "won" && item.status !== "prevented")) {
      return [{ orderId, transactionId, action: "chargeback", status: "approved", type: "full", currency }];
    }
    const refunded = refunds.items.filter((item) => item.status === "succeeded");
    if (!refunded.length) return [];
    const full = refunded.reduce((sum, item) => sum + item.amount, 0) >= order.net_amount &&
      refunded.reduce((sum, item) => sum + item.tax_amount, 0) >= order.tax_amount;
    return [{ orderId, transactionId, action: "refund", status: "approved", type: full ? "full" : "partial", currency }];
  }

  async getAdjustments(id: string) {
    const order = await this.findOrder(id);
    return order ? this.orderAdjustments(order) : [];
  }

  async getCustomerEmail(id: string) {
    const customer = await this.client.customers.get(id);
    if (customer.organization_id !== this.settings.organizationId || !customer.email) {
      throw new Error("polar_customer_mismatch");
    }
    return customer.email;
  }

  async verifyWebhook(body: string, headers: Record<string, string>) {
    let event;
    try {
      event = await webhooks.validateEvent(body, headers, this.settings.webhookSecret);
    } catch (error) {
      if (error instanceof webhooks.PolarWebhookUnknownTypeError) return null;
      throw new InvalidWebhook();
    }
    const id = headers["webhook-id"];
    if (!id || id.length > 128) throw new InvalidWebhook();
    const occurredAt = new Date(event.timestamp);
    let order: models.Order;
    switch (event.type) {
      case "order.paid":
      case "order.refunded":
      case "order.updated":
        order = event.data;
        break;
      case "refund.created":
      case "refund.updated":
        if (event.data.organization_id !== this.settings.organizationId) return null;
        order = await this.client.orders.get(event.data.order_id);
        break;
      default:
        return null;
    }
    if (order.product_id !== this.priceId || !order.checkout_id) return null;
    const checkout = await this.client.checkouts.get(order.checkout_id);
    const payment = this.settledOrder(order, checkout, new Date(order.created_at));
    const [adjustment] = await this.orderAdjustments(order);
    if (adjustment?.type === "full" || (adjustment && event.type !== "order.paid")) {
      return { id, occurredAt, type: "adjustment.updated", adjustment };
    }
    if (event.type === "order.paid" && payment.status === "completed") {
      return { id, occurredAt, type: "transaction.completed", payment, adjustments: adjustment ? [adjustment] : [] };
    }
    return null;
  }
}
