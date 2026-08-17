CREATE TABLE "alpha_profile_exposures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"viewer_user_id" text NOT NULL,
	"target_profile_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_normalized" text NOT NULL,
	"acquisition_channel" text DEFAULT 'organic' NOT NULL,
	"access_token_hash" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_entries_acquisition_channel_check" CHECK ("waitlist_entries"."acquisition_channel" IN ('founder_direct', 'referral', 'writing_community', 'subculture_community', 'dating_fatigue_community', 'quiet_introvert_community', 'organic', 'other_declared'))
);
--> statement-breakpoint
CREATE TABLE "waitlist_visit_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"waitlist_entry_id" uuid NOT NULL,
	"visit_date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alpha_profile_exposures" ADD CONSTRAINT "alpha_profile_exposures_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alpha_profile_exposures" ADD CONSTRAINT "alpha_profile_exposures_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_visit_days" ADD CONSTRAINT "waitlist_visit_days_waitlist_entry_id_waitlist_entries_id_fk" FOREIGN KEY ("waitlist_entry_id") REFERENCES "public"."waitlist_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alpha_profile_exposures_viewer_target_unique" ON "alpha_profile_exposures" USING btree ("viewer_user_id","target_profile_id");--> statement-breakpoint
CREATE INDEX "alpha_profile_exposures_target_idx" ON "alpha_profile_exposures" USING btree ("target_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_email_unique" ON "waitlist_entries" USING btree ("email_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_token_hash_unique" ON "waitlist_entries" USING btree ("access_token_hash");--> statement-breakpoint
CREATE INDEX "waitlist_entries_channel_created_idx" ON "waitlist_entries" USING btree ("acquisition_channel","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_visit_days_entry_date_unique" ON "waitlist_visit_days" USING btree ("waitlist_entry_id","visit_date");--> statement-breakpoint
CREATE INDEX "waitlist_visit_days_date_idx" ON "waitlist_visit_days" USING btree ("visit_date");
