CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_user_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_distinct_users_check" CHECK ("messages"."sender_user_id" <> "messages"."recipient_user_id"),
	CONSTRAINT "messages_body_length_check" CHECK (char_length("messages"."body") BETWEEN 1 AND 500)
);
--> statement-breakpoint
CREATE TABLE "alpha_activity_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"activity_date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alpha_invites" ADD COLUMN "target_phase" text DEFAULT 'legacy_pre_stage1' NOT NULL;--> statement-breakpoint
ALTER TABLE "alpha_invites" ALTER COLUMN "target_phase" SET DEFAULT 'alpha_stage_1';--> statement-breakpoint
ALTER TABLE "alpha_invites" ADD COLUMN "recruitment_cohort" text DEFAULT 'legacy_unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "alpha_invites" ADD COLUMN "acquisition_channel" text DEFAULT 'legacy_unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "alpha_invites" ADD COLUMN "balance_bucket" text DEFAULT 'not_counted' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alpha_activity_days" ADD CONSTRAINT "alpha_activity_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_sender_recipient_created_idx" ON "messages" USING btree ("sender_user_id","recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_recipient_sender_created_idx" ON "messages" USING btree ("recipient_user_id","sender_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "alpha_activity_days_user_date_unique" ON "alpha_activity_days" USING btree ("user_id","activity_date");--> statement-breakpoint
CREATE INDEX "alpha_activity_days_date_idx" ON "alpha_activity_days" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "alpha_invites_phase_status_idx" ON "alpha_invites" USING btree ("target_phase","status");--> statement-breakpoint
CREATE INDEX "alpha_invites_cohort_idx" ON "alpha_invites" USING btree ("recruitment_cohort");--> statement-breakpoint
ALTER TABLE "alpha_invites" ADD CONSTRAINT "alpha_invites_target_phase_check" CHECK ("alpha_invites"."target_phase" IN ('alpha_stage_1', 'legacy_pre_stage1'));--> statement-breakpoint
ALTER TABLE "alpha_invites" ADD CONSTRAINT "alpha_invites_recruitment_cohort_check" CHECK ("alpha_invites"."recruitment_cohort" IN ('founder_network', 'writing_reading', 'subculture_meme', 'dating_app_fatigue', 'quiet_introvert', 'legacy_unassigned'));--> statement-breakpoint
ALTER TABLE "alpha_invites" ADD CONSTRAINT "alpha_invites_acquisition_channel_check" CHECK ("alpha_invites"."acquisition_channel" IN ('founder_direct', 'referral', 'writing_community', 'subculture_community', 'dating_fatigue_community', 'quiet_introvert_community', 'organic', 'other_declared', 'legacy_unknown'));--> statement-breakpoint
ALTER TABLE "alpha_invites" ADD CONSTRAINT "alpha_invites_balance_bucket_check" CHECK ("alpha_invites"."balance_bucket" IN ('bucket_a', 'bucket_b', 'not_counted'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_alpha_stage1_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  active_seats integer;
BEGIN
  IF NEW.target_phase = 'alpha_stage_1'
     AND NEW.status IN ('pending', 'reserved', 'consumed')
     AND (NEW.status = 'consumed' OR NEW.expires_at > now()) THEN
    PERFORM pg_advisory_xact_lock(hashtext('unstandard:alpha-stage-1:capacity'));

    SELECT count(*)::integer
    INTO active_seats
    FROM public.alpha_invites
    WHERE id <> NEW.id
      AND target_phase = 'alpha_stage_1'
      AND (
        status = 'consumed'
        OR (status IN ('pending', 'reserved') AND expires_at > now())
      );

    IF active_seats >= 50 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'alpha_stage1_capacity_max_50',
        MESSAGE = 'closed alpha stage 1 capacity reached';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER alpha_stage1_capacity_guard
BEFORE INSERT OR UPDATE OF status, target_phase, expires_at
ON public.alpha_invites
FOR EACH ROW
EXECUTE FUNCTION public.enforce_alpha_stage1_capacity();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.delete_user_linked_residuals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.reports
  WHERE
    (target_type = 'profile' AND target_id IN (
      SELECT id::text FROM public.profiles WHERE user_id = OLD.id
    ))
    OR
    (target_type = 'answer' AND target_id IN (
      SELECT id::text FROM public.answers WHERE user_id = OLD.id
    ))
    OR
    (target_type = 'message' AND target_id IN (
      SELECT id::text
      FROM public.messages
      WHERE sender_user_id = OLD.id OR recipient_user_id = OLD.id
    ));

  IF current_setting('unstandard.registration_compensation', true) IS DISTINCT FROM 'on' THEN
    DELETE FROM public.alpha_invites
    WHERE consumed_by_user_id = OLD.id
       OR email_normalized = lower(trim(OLD.email));
  END IF;

  DELETE FROM public.verifications
  WHERE value = OLD.id OR identifier = OLD.email;

  RETURN OLD;
END;
$$;
