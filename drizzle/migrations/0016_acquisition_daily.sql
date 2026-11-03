CREATE TABLE "acquisition_daily" (
	"day" date NOT NULL,
	"event" text NOT NULL,
	"channel" text NOT NULL,
	"campaign" text NOT NULL,
	"content" text NOT NULL,
	"count" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "acquisition_daily_day_event_channel_campaign_content_pk" PRIMARY KEY("day","event","channel","campaign","content"),
	CONSTRAINT "acquisition_daily_event_check" CHECK ("acquisition_daily"."event" IN ('landing_view','alpha_cta_click','waitlist_form_view','waitlist_submit_attempt','waitlist_submit_accepted','waitlist_created','waitlist_submit_error')),
	CONSTRAINT "acquisition_daily_channel_check" CHECK ("acquisition_daily"."channel" IN ('instagram_paid','instagram_organic','everytime','direct_or_unattributed','other_unknown')),
	CONSTRAINT "acquisition_daily_campaign_check" CHECK ("acquisition_daily"."campaign" IN ('none','unknown','alpha_recruitment')),
	CONSTRAINT "acquisition_daily_content_check" CHECK ("acquisition_daily"."content" IN ('none','unknown','reel_a','reel_b','post_a','post_b')),
	CONSTRAINT "acquisition_daily_count_check" CHECK ("acquisition_daily"."count" >= 0)
);
