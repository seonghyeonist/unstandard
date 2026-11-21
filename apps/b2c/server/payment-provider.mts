import { createHmac } from "node:crypto";

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
  customerId: string | null; paidAt: Date | null; checkoutUrl?: string;
};
export type Adjustment = { orderId?: string; transactionId: string; action: string; status: string; type: string; currency: string };
export type PaymentEvent = { id: string; type: string; occurredAt: Date } &
  ({ payment: Payment; adjustments?: Adjustment[] } | { adjustment: Adjustment });
export type PaymentProvider = {
  mode: PaymentMode;
  priceId: string;
  validateCatalog(): Promise<void>;
  createTransaction(order: OrderReference): Promise<Payment>;
  findTransaction(order: OrderReference): Promise<Payment | null>;
  getTransaction(id: string): Promise<Payment>;
  getAdjustments(id: string): Promise<Adjustment[]>;
  getCustomerEmail(id: string): Promise<string>;
  checkoutUrl?(id: string): Promise<string | undefined>;
  verifyWebhook(body: string, headers: Record<string, string>): Promise<PaymentEvent | null>;
};

export const uuidPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export class InvalidWebhook extends Error {}

export function validPayment(payment: Payment, orderId: string, priceId: string) {
  return payment.orderId === orderId && payment.priceId === priceId && payment.quantity === 1 &&
    payment.currency === currency && payment.unitSubtotal === String(cents);
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
  async verifyWebhook(body: string, headers: Record<string, string>) {
    if (headers["webhook-signature"] !== signFixture(body, this.secret, this.clock())) throw new InvalidWebhook();
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
