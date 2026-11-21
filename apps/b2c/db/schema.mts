import { sql } from "drizzle-orm";
import {
  check, foreignKey, index, integer, jsonb, pgSchema, text, timestamp, unique,
  uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

export const schema = pgSchema("b2c");
const stamp = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const orders = schema.table("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestKey: uuid("request_key").notNull().unique(),
  sku: text("sku").notNull(),
  usdCents: integer("usd_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  priceId: text("price_id").notNull(),
  providerTx: text("provider_tx").unique(),
  state: text("state", { enum: ["pending", "paid", "refunded", "disputed"] }).notNull().default("pending"),
  createdAt: stamp("created_at").notNull().defaultNow(),
  paidAt: stamp("paid_at"),
  paymentMode: text("payment_mode", { enum: ["synthetic", "sandbox"] }),
  checkoutLocale: text("checkout_locale", { enum: ["en", "ko"] }),
  purchaseDigest: text("purchase_digest"),
  purchaseExpiresAt: stamp("purchase_expires_at"),
  purchaseRevokedAt: stamp("purchase_revoked_at"),
  customerId: text("payment_customer_id"),
  emailDigest: text("payment_email_digest"),
  paymentReview: text("payment_review"),
  checkoutAttemptAt: stamp("checkout_attempt_at"),
}, (t) => [
  index("orders_payment_email").on(t.emailDigest),
  index("orders_payment_pending").on(t.createdAt).where(sql`${t.state} = 'pending'`),
  check("orders_payment_mode", sql`${t.paymentMode} in ('synthetic', 'sandbox')`),
  check("orders_checkout_locale", sql`${t.checkoutLocale} in ('en', 'ko')`),
  check("orders_purchase_digest", sql`${t.purchaseDigest} ~ '^[0-9a-f]{64}$'`),
  check("orders_email_digest", sql`${t.emailDigest} ~ '^[0-9a-f]{64}$'`),
  check("orders_usd_only", sql`${t.currency} = 'USD' and ${t.usdCents} > 0`),
  check("orders_state", sql`${t.state} in ('pending', 'paid', 'refunded', 'disputed')`),
  check("orders_paid_fields", sql`${t.state} <> 'paid' or (${t.paidAt} is not null and ${t.providerTx} is not null)`),
]);

export const paymentEvents = schema.table("payment_events", {
  id: text("event_id").primaryKey(),
  type: text("event_type").notNull(),
  providerTx: text("provider_tx").notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  occurredAt: stamp("occurred_at").notNull(),
  receivedAt: stamp("received_at").notNull().defaultNow(),
}, (t) => [index("payment_events_tx_time").on(t.providerTx, t.occurredAt)]);

export const rooms = schema.table("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id).unique(),
  expiresAt: stamp("expires_at").notNull(),
  revokedAt: stamp("revoked_at"),
}, (t) => [index("rooms_expiration").on(t.expiresAt)]);

export const members = schema.table("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["buyer", "partner"] }).notNull(),
  locale: text("locale", { enum: ["en", "ko"] }).notNull(),
  timeZone: text("time_zone").notNull().default("UTC"),
  revision: integer("revision").notNull().default(0),
  revokedAt: stamp("revoked_at"),
}, (t) => [
  unique("members_room_role").on(t.roomId, t.role),
  unique("members_room_id").on(t.roomId, t.id),
  check("members_role", sql`${t.role} in ('buyer', 'partner')`),
  check("members_locale", sql`${t.locale} in ('en', 'ko')`),
  check("members_revision", sql`${t.revision} >= 0`),
]);

export const sessions = schema.table("sessions", {
  digest: text("token_digest").primaryKey(),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  issuedAt: stamp("issued_at").notNull(),
  expiresAt: stamp("expires_at").notNull(),
  revokedAt: stamp("revoked_at"),
}, (t) => [
  index("sessions_member").on(t.memberId),
  index("sessions_expiration").on(t.expiresAt),
  check("sessions_digest", sql`${t.digest} ~ '^[0-9a-f]{64}$'`),
  check("sessions_lifetime", sql`${t.expiresAt} > ${t.issuedAt}`),
]);

export type Slot = { id: string; startsAt: string; endsAt: string };
export type Choice = { slotId: string; channel: "text" | "call"; minutes: 5 | 15 | 30 };

export const rounds = schema.table("rounds", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  slots: jsonb("slots").$type<Slot[]>().notNull(),
  deadline: stamp("deadline").notNull(),
}, (t) => [
  unique("rounds_room_id").on(t.roomId, t.id),
  check("rounds_version", sql`${t.version} >= 0`),
  check("rounds_slots", sql`case when jsonb_typeof(${t.slots}) = 'array' then jsonb_array_length(${t.slots}) between 1 and 6 else false end`),
]);

export const submissions = schema.table("submissions", {
  roomId: uuid("room_id").notNull(),
  roundId: uuid("round_id").notNull(),
  memberId: uuid("member_id").notNull(),
  tuples: jsonb("tuples").$type<Choice[]>().notNull(),
  shareVersion: integer("share_version").notNull().default(0),
}, (t) => [
  unique("submissions_round_member").on(t.roundId, t.memberId),
  foreignKey({ name: "submissions_round_scope", columns: [t.roomId, t.roundId], foreignColumns: [rounds.roomId, rounds.id] }).onDelete("cascade"),
  foreignKey({ name: "submissions_member_scope", columns: [t.roomId, t.memberId], foreignColumns: [members.roomId, members.id] }).onDelete("cascade"),
  index("submissions_member_scope_idx").on(t.roomId, t.memberId),
  check("submissions_tuples", sql`case when jsonb_typeof(${t.tuples}) = 'array' then jsonb_array_length(${t.tuples}) <= 36 else false end`),
  check("submissions_version", sql`${t.shareVersion} >= 0`),
]);

export const votes = schema.table("votes", {
  roomId: uuid("room_id").notNull(),
  roundId: uuid("round_id").notNull(),
  memberId: uuid("member_id").notNull(),
  candidateId: text("candidate_id").notNull(),
  revision: integer("revision").notNull(),
  acceptedAt: stamp("accepted_at").notNull(),
}, (t) => [
  unique("votes_round_member").on(t.roundId, t.memberId),
  foreignKey({ name: "votes_round_scope", columns: [t.roomId, t.roundId], foreignColumns: [rounds.roomId, rounds.id] }).onDelete("cascade"),
  foreignKey({ name: "votes_member_scope", columns: [t.roomId, t.memberId], foreignColumns: [members.roomId, members.id] }).onDelete("cascade"),
  index("votes_member_scope_idx").on(t.roomId, t.memberId),
  check("votes_revision", sql`${t.revision} >= 0`),
]);

export const cards = schema.table("cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  roundId: uuid("round_id"),
  ownerMemberId: uuid("owner_member_id"),
  kind: text("kind", { enum: ["personal", "shared"] }).notNull(),
  revision: integer("revision").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
}, (t) => [
  uniqueIndex("cards_shared_revision").on(t.roundId, t.kind, t.revision).where(sql`${t.kind} = 'shared'`),
  uniqueIndex("cards_personal_revision").on(t.roomId, t.ownerMemberId, t.revision).where(sql`${t.kind} = 'personal'`),
  foreignKey({ name: "cards_round_scope", columns: [t.roomId, t.roundId], foreignColumns: [rounds.roomId, rounds.id] }).onDelete("cascade"),
  foreignKey({ name: "cards_owner_scope", columns: [t.roomId, t.ownerMemberId], foreignColumns: [members.roomId, members.id] }).onDelete("cascade"),
  index("cards_room").on(t.roomId),
  check("cards_scope", sql`(${t.kind} = 'personal' and ${t.ownerMemberId} is not null and ${t.roundId} is null)
    or (${t.kind} = 'shared' and ${t.ownerMemberId} is null and ${t.roundId} is not null)`),
  check("cards_revision", sql`${t.revision} >= 0`),
]);

export const jobs = schema.table("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  kind: text("kind").notNull(),
  revision: integer("revision").notNull().default(0),
  leaseUntil: stamp("lease_until"),
  attempts: integer("attempts").notNull().default(0),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  finishedAt: stamp("finished_at"),
}, (t) => [
  unique("jobs_order_kind_revision").on(t.orderId, t.kind, t.revision),
  index("jobs_open_lease").on(t.leaseUntil).where(sql`${t.finishedAt} is null`),
  check("jobs_attempts", sql`${t.attempts} between 0 and 3 and ${t.revision} >= 0`),
]);

export const invites = schema.table("invites", {
  digest: text("token_digest").primaryKey(),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  expiresAt: stamp("expires_at").notNull(),
  usedAt: stamp("used_at"),
  revokedAt: stamp("revoked_at"),
}, (t) => [
  uniqueIndex("invites_one_open_per_room").on(t.roomId).where(sql`${t.usedAt} is null and ${t.revokedAt} is null`),
  index("invites_room").on(t.roomId),
  check("invites_digest", sql`${t.digest} ~ '^[0-9a-f]{64}$'`),
]);

export const recoveryTokens = schema.table("recovery_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  digest: text("token_digest").notNull().unique(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  expiresAt: stamp("expires_at").notNull(),
  usedAt: stamp("used_at"),
  revokedAt: stamp("revoked_at"),
}, (t) => [
  index("recovery_order").on(t.orderId),
  check("recovery_digest", sql`${t.digest} ~ '^[0-9a-f]{64}$'`),
]);

export const paymentRateLimits = schema.table("payment_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: stamp("expires_at").notNull(),
}, (t) => [index("payment_rate_limits_expires").on(t.expiresAt)]);
