CREATE TABLE "alpha_email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_id" uuid NOT NULL,
	"email_normalized" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"consumed_by_user_id" text,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alpha_email_verifications_attempt_count_check" CHECK ("alpha_email_verifications"."attempt_count" >= 0 AND "alpha_email_verifications"."attempt_count" <= 5)
);
--> statement-breakpoint
ALTER TABLE "alpha_email_verifications" ADD CONSTRAINT "alpha_email_verifications_invite_id_alpha_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."alpha_invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alpha_email_verifications" ADD CONSTRAINT "alpha_email_verifications_consumed_by_user_id_users_id_fk" FOREIGN KEY ("consumed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alpha_email_verifications_invite_idx" ON "alpha_email_verifications" USING btree ("invite_id","created_at");--> statement-breakpoint
CREATE INDEX "alpha_email_verifications_expiry_idx" ON "alpha_email_verifications" USING btree ("expires_at");