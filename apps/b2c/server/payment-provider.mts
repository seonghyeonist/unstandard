import { createHmac } from "node:crypto";
import { Environment, LogLevel, Paddle, Webhooks } from "@paddle/paddle-node-sdk";

export const sku = "recontact-v4";
export const cents = 899;
export const currency = "USD";
export type Clock = () => Date;
export type Locale = "en" | "ko";
export type PaymentMode = "synthetic" | "sandbox";
export type OrderReference = { id: string; createdAt: Date };
export type Payment = {
  id: string; orderId: string | null; status: string; currency: string;
  priceId: string | null; quantity: number; unitSubtotal: string | null;
  customerId: string | null; paidAt: Date | null;
};
export type Adjustment = { transactionId: string; action: string; status: string; type: string; currency: string };
export type PaymentEvent = { id: string; type: string; occurredAt: Date } &
  ({ payment: Payment } | { adjustment: Adjustment });
export type PaymentProvider = {
  mode: PaymentMode;
  priceId: string;
  validateCatalog(): Promise<void>;
  createTransaction(order: OrderReference): Promise<Payment>;
  findTransaction(order: OrderReference): Promise<Payment | null>;
  getTransaction(id: string): Promise<Payment>;
  getAdjustments(id: string): Promise<Adjustment[]>;
  getCustomerEmail(id: string): Promise<string>;
  verifyWebhook(body: string, signature: string, source: "platform" | "simulator"): Promise<PaymentEvent | null>;
};

const eventTypes = new Set(["transaction.completed", "adjustment.created", "adjustment.updated"]);
export const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const signaturePattern = /^(?:ts=\d{10};h1=[a-f0-9]{64}|h1=[a-f0-9]{64};ts=\d{10})$/;
const paddleId = (prefix: string, value: string) => new RegExp(`^${prefix}_[a-z0-9]{26}$`).test(value);

type PaddleTransaction = Awaited<ReturnType<Paddle["transactions"]["get"]>>;

function transaction(data: PaddleTransaction | Pick<PaddleTransaction, "id" | "status" | "customData" |
  "origin" | "collectionMode" | "subscriptionId" | "discountId" | "currencyCode" | "customerId" |
  "items" | "details" | "payments">): Payment {
  const item = data.items.length === 1 ? data.items[0] : undefined;
  const line = data.details?.lineItems.length === 1 ? data.details.lineItems[0] : undefined;
  const price = item?.price;
  const orderId = data.customData?.b2c_order_id;
  const captures = data.payments.flatMap((payment) => {
    const time = payment.capturedAt ? Date.parse(payment.capturedAt) : NaN;
    return payment.status === "captured" && Number.isFinite(time) ? [time] : [];
  });
  const validItem = price && !price.billingCycle && price.unitPrice?.amount === String(cents) &&
    price.unitPrice?.currencyCode === currency && !data.discountId &&
    !data.subscriptionId && data.collectionMode === "automatic" && data.origin === "api";
  return {
    id: data.id, orderId: typeof orderId === "string" ? orderId : null,
    status: data.status, currency: data.currencyCode,
    priceId: validItem ? price.id : null, quantity: item?.quantity ?? 0,
    unitSubtotal: line?.priceId === price?.id && line?.quantity === item?.quantity &&
      line?.unitTotals?.discount === "0" ? line.unitTotals.subtotal : null,
    customerId: data.customerId,
    paidAt: captures.length ? new Date(Math.min(...captures)) : null,
  };
}

function normalizeAdjustment(data: { transactionId: string; action: string; status: string; type: string; currencyCode: string }): Adjustment {
  return { transactionId: data.transactionId, action: data.action, status: data.status, type: data.type, currency: data.currencyCode };
}

export function validPayment(payment: Payment, orderId: string, priceId: string) {
  return payment.orderId === orderId && payment.priceId === priceId && payment.quantity === 1 &&
    payment.currency === currency && payment.unitSubtotal === String(cents);
}

type SandboxProviderSettings = { apiKey: string; priceId: string; platformSecret: string;
  simulatorSecret: string; checkoutUrl: string };

export class PaddleSandboxProvider implements PaymentProvider {
  readonly mode = "sandbox";
  private readonly client: Paddle;

  private readonly settings: SandboxProviderSettings;

  constructor(settings: SandboxProviderSettings) {
    if (!/^pdl_sdbx_apikey_[a-z0-9_]+$/i.test(settings.apiKey) || !paddleId("pri", settings.priceId) ||
      !settings.platformSecret || !settings.simulatorSecret || settings.platformSecret === settings.simulatorSecret ||
      new URL(settings.checkoutUrl).protocol !== "https:") {
      throw new Error("Invalid isolated Paddle Sandbox settings");
    }
    this.settings = settings;
    this.client = new Paddle(settings.apiKey, { environment: Environment.sandbox, logLevel: LogLevel.none });
  }

  get priceId() { return this.settings.priceId; }

  async validateCatalog() {
    const price = await this.client.prices.get(this.priceId);
    const product = await this.client.products.get(price.productId);
    if (price.status !== "active" || product.status !== "active" || price.billingCycle || price.trialPeriod ||
      price.unitPrice.currencyCode !== currency || price.unitPrice.amount !== String(cents) ||
      price.taxMode !== "external" || price.unitPriceOverrides.length ||
      price.quantity.minimum !== 1 || price.quantity.maximum !== 1) {
      throw new Error("Sandbox catalog differs from B2C price contract");
    }
  }

  async createTransaction(order: OrderReference) {
    return transaction(await this.client.transactions.create({
      items: [{ priceId: this.priceId, quantity: 1 }],
      customData: { b2c_order_id: order.id },
      currencyCode: currency, collectionMode: "automatic",
      checkout: { url: this.settings.checkoutUrl },
    }));
  }

  async findTransaction(order: OrderReference) {
    const matches: Payment[] = [];
    const recent = this.client.transactions.list({
      origin: ["api"], "createdAt[GTE]": order.createdAt.toISOString(), perPage: 30,
    });
    let scanned = 0;
    for await (const candidate of recent) {
      if (++scanned > 90) throw new Error("Sandbox transaction lookup exceeded its review boundary");
      if (candidate.customData?.b2c_order_id === order.id) matches.push(transaction(candidate));
    }
    if (matches.length > 1) throw new Error("Ambiguous Sandbox transaction");
    return matches[0] ?? null;
  }

  async getTransaction(id: string) {
    if (!paddleId("txn", id)) throw new Error("Invalid Sandbox transaction reference");
    return transaction(await this.client.transactions.get(id));
  }

  async getAdjustments(id: string) {
    if (!paddleId("txn", id)) throw new Error("Invalid Sandbox transaction reference");
    const entries: Adjustment[] = [];
    for await (const adjustment of this.client.adjustments.list({ transactionId: [id] })) {
      if (entries.length >= 100) throw new Error("Sandbox adjustment lookup exceeded its review boundary");
      entries.push(normalizeAdjustment(adjustment));
    }
    return entries;
  }

  async getCustomerEmail(id: string) {
    return (await this.client.customers.get(id)).email;
  }

  async verifyWebhook(body: string, signature: string, source: "platform" | "simulator") {
    const secret = source === "platform" ? this.settings.platformSecret : this.settings.simulatorSecret;
    if (!signaturePattern.test(signature) || !await this.client.webhooks.isSignatureValid(body, secret, signature)) {
      throw new Error("Invalid signature");
    }
    const raw = JSON.parse(body);
    const eventPrefix = source === "platform" ? "evt" : "ntfsimevt";
    if (!raw || typeof raw.event_type !== "string" || !raw.data || !paddleId(eventPrefix, raw.event_id ?? "") ||
      !Number.isFinite(Date.parse(raw.occurred_at))) throw new Error("Invalid envelope");
    if (!eventTypes.has(raw.event_type)) return null;
    const event = Webhooks.fromJson(raw);
    const envelope = { id: event.eventId, type: event.eventType, occurredAt: new Date(event.occurredAt) };
    if (event.eventType === "transaction.completed") {
      // The SDK notification entities have structurally equivalent fields.
      return { ...envelope, payment: transaction(event.data as unknown as PaddleTransaction) };
    }
    if (event.eventType === "adjustment.created" || event.eventType === "adjustment.updated") {
      return { ...envelope, adjustment: normalizeAdjustment(event.data) };
    }
    return null;
  }
}

export class SyntheticPaymentProvider implements PaymentProvider {
  readonly mode = "synthetic";
  readonly priceId = "synthetic-recontact-899";
  readonly transactions = new Map<string, Payment>();
  readonly adjustments = new Map<string, Adjustment[]>();
  readonly emails = new Map<string, string>();

  private readonly secret: string;
  private readonly clock: Clock;
  constructor(secret: string, clock: Clock) {
    this.secret = secret;
    this.clock = clock;
  }
  async validateCatalog() {}
  async createTransaction(order: OrderReference) {
    const payment = {
      id: `synthetic-${order.id}`, orderId: order.id, status: "draft", currency,
      priceId: this.priceId, quantity: 1, unitSubtotal: String(cents), customerId: null, paidAt: null,
    };
    this.transactions.set(payment.id, payment);
    return payment;
  }
  async findTransaction(order: OrderReference) { return this.transactions.get(`synthetic-${order.id}`) ?? null; }
  async getTransaction(id: string) {
    const value = this.transactions.get(id);
    if (!value) throw new Error("Missing synthetic transaction");
    return value;
  }
  async getAdjustments(id: string) { return this.adjustments.get(id) ?? []; }
  async getCustomerEmail(id: string) {
    const email = this.emails.get(id);
    if (!email) throw new Error("Missing synthetic customer");
    return email;
  }
  async verifyWebhook(body: string, signature: string, source: "platform" | "simulator") {
    if (source !== "platform" || !signaturePattern.test(signature) ||
      signature !== signFixture(body, this.secret, this.clock())) throw new Error("Invalid synthetic signature");
    const event = JSON.parse(body);
    return { ...event, occurredAt: new Date(event.occurredAt),
      ...(event.payment ? { payment: { ...event.payment, paidAt: event.payment.paidAt ? new Date(event.payment.paidAt) : null } } : {}),
    } as PaymentEvent;
  }
}

export function signFixture(body: string, secret: string, now: Date) {
  const timestamp = Math.floor(now.getTime() / 1000);
  return `ts=${timestamp};h1=${createHmac("sha256", secret).update(`${timestamp}:${body}`).digest("hex")}`;
}
