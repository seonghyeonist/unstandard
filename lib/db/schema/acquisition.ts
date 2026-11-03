import { sql } from "drizzle-orm";
import { bigint, check, date, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
export const acquisitionDaily = pgTable("acquisition_daily", {
  day: date("day", { mode: "string" }).notNull(),
  event: text("event").notNull(),
  channel: text("channel").notNull(),
  campaign: text("campaign").notNull(),
  content: text("content").notNull(),
  count: bigint("count", { mode: "number" }).notNull().default(0),
}, table => [
  primaryKey({ columns: [table.day, table.event, table.channel, table.campaign, table.content] }),
  check("acquisition_daily_event_check", sql`${table.event} IN ('landing_view','alpha_cta_click','waitlist_form_view','waitlist_submit_attempt','waitlist_submit_accepted','waitlist_created','waitlist_submit_error')`),
  check("acquisition_daily_channel_check", sql`${table.channel} IN ('instagram_paid','instagram_organic','everytime','direct_or_unattributed','other_unknown')`),
  check("acquisition_daily_campaign_check", sql`${table.campaign} IN ('none','unknown','alpha_recruitment')`),
  check("acquisition_daily_content_check", sql`${table.content} IN ('none','unknown','reel_a','reel_b','post_a','post_b')`),
  check("acquisition_daily_count_check", sql`${table.count} >= 0`),
]);
