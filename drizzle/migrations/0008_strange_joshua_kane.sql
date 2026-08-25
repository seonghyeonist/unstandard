CREATE TABLE "legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"adult_confirmed" boolean NOT NULL,
	"terms_version" text NOT NULL,
	"safety_rules_version" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "legal_acceptances_adult_confirmed_check" CHECK ("legal_acceptances"."adult_confirmed" = true),
	CONSTRAINT "legal_acceptances_terms_version_check" CHECK ("legal_acceptances"."terms_version" = 'closed-alpha-terms-v1'),
	CONSTRAINT "legal_acceptances_safety_rules_version_check" CHECK ("legal_acceptances"."safety_rules_version" = 'closed-alpha-safety-v1')
);
--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legal_acceptances_user_id_idx" ON "legal_acceptances" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_acceptances_user_versions_unique" ON "legal_acceptances" USING btree ("user_id","terms_version","safety_rules_version");
