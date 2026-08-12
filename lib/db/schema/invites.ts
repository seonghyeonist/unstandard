import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/auth";
import {
  ALPHA_STAGE_1_PHASE,
  LEGACY_PRE_STAGE_1_PHASE,
} from "@/lib/alpha/stage1-policy";

export const alphaInvites = pgTable(
  "alpha_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailNormalized: text("email_normalized").notNull(),
    codeHash: text("code_hash").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
    reservationNonceHash: text("reservation_nonce_hash"),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByUserId: text("consumed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetPhase: text("target_phase").notNull().default(ALPHA_STAGE_1_PHASE),
    recruitmentCohort: text("recruitment_cohort").notNull().default("legacy_unassigned"),
    acquisitionChannel: text("acquisition_channel").notNull().default("legacy_unknown"),
    balanceBucket: text("balance_bucket").notNull().default("not_counted"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("alpha_invites_code_hash_unique").on(table.codeHash),
    index("alpha_invites_email_idx").on(table.emailNormalized),
    index("alpha_invites_reserved_stale_idx").on(table.status, table.reservedAt),
    index("alpha_invites_claim_idx").on(table.codeHash, table.emailNormalized, table.status),
    index("alpha_invites_phase_status_idx").on(table.targetPhase, table.status),
    index("alpha_invites_cohort_idx").on(table.recruitmentCohort),
    check(
      "alpha_invites_target_phase_check",
      sql`${table.targetPhase} IN (${ALPHA_STAGE_1_PHASE}, ${LEGACY_PRE_STAGE_1_PHASE})`,
    ),
    check(
      "alpha_invites_recruitment_cohort_check",
      sql`${table.recruitmentCohort} IN ('founder_network', 'writing_reading', 'subculture_meme', 'dating_app_fatigue', 'quiet_introvert', 'legacy_unassigned')`,
    ),
    check(
      "alpha_invites_acquisition_channel_check",
      sql`${table.acquisitionChannel} IN ('founder_direct', 'referral', 'writing_community', 'subculture_community', 'dating_fatigue_community', 'quiet_introvert_community', 'organic', 'other_declared', 'legacy_unknown')`,
    ),
    check(
      "alpha_invites_balance_bucket_check",
      sql`${table.balanceBucket} IN ('bucket_a', 'bucket_b', 'not_counted')`,
    ),
  ],
);
