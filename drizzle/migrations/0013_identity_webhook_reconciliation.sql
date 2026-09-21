ALTER TABLE "identity_verifications" ADD COLUMN "completion_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD COLUMN "completion_event_id" uuid;