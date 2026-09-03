import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";

// No backfill: an absent row means the user has not supplied these fields.
export const profileBasics = pgTable("profile_basics", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  gender: text("gender").notNull(),
  age: integer("age").notNull(),
  region: text("region").notNull(),
  introductionScopeAccepted: boolean("introduction_scope_accepted").notNull(),
  introductionScopeVersion: text("introduction_scope_version").notNull(),
  profileConsentVersion: text("profile_consent_version").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  revision: uuid("revision").defaultRandom().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  check("profile_basics_gender_check", sql`${t.gender} IN ('male', 'female')`),
  check("profile_basics_age_check", sql`${t.age} BETWEEN 19 AND 120`),
  check("profile_basics_region_check", sql`${t.region} IN ('서울','경기','인천','부산','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주')`),
]);

// A bounded single request/result per user. Never store name, phone, DOB, CI/DI, provider payload or OTP.
export const identityVerifications = pgTable("identity_verifications", {
  userId: text("user_id").primaryKey().references(() => profileBasics.userId, { onDelete: "cascade" }),
  requestId: uuid("request_id").notNull().unique(),
  profileRevision: uuid("profile_revision").notNull(),
  status: text("status").notNull(),
  provider: text("provider").notNull(),
  providerReference: text("provider_reference"),
  biometricConsentVersion: text("biometric_consent_version").notNull(),
  noticeVersion: text("notice_version").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  providerPurgedAt: timestamp("provider_purged_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("identity_verifications_provider_reference_unique").on(t.providerReference),
  check("identity_status_check", sql`${t.status} IN ('pending', 'verified_unpurged', 'verified')`),
  check("identity_result_check", sql`(
    (${t.status} = 'pending' AND ${t.verifiedAt} IS NULL AND ${t.providerPurgedAt} IS NULL)
    OR (${t.status} = 'verified_unpurged' AND ${t.verifiedAt} IS NOT NULL AND ${t.providerPurgedAt} IS NULL)
    OR (${t.status} = 'verified' AND ${t.verifiedAt} IS NOT NULL AND ${t.providerPurgedAt} IS NOT NULL)
  )`),
  check("identity_provider_reference_check", sql`${t.status} = 'pending' OR ${t.providerReference} IS NOT NULL`),
  check("identity_expiry_check", sql`${t.expiresAt} > ${t.requestedAt}`),
]);
