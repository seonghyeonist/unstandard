CREATE TABLE "identity_verifications" (
	"user_id" text PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"profile_revision" uuid NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "identity_verifications_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "identity_status_check" CHECK ("identity_verifications"."status" IN ('pending', 'verified')),
	CONSTRAINT "identity_result_check" CHECK (("identity_verifications"."status" = 'pending' AND "identity_verifications"."verified_at" IS NULL) OR ("identity_verifications"."status" = 'verified' AND "identity_verifications"."verified_at" IS NOT NULL)),
	CONSTRAINT "identity_expiry_check" CHECK ("identity_verifications"."expires_at" > "identity_verifications"."requested_at")
);
--> statement-breakpoint
CREATE TABLE "profile_basics" (
	"user_id" text PRIMARY KEY NOT NULL,
	"gender" text NOT NULL,
	"age" integer NOT NULL,
	"region" text NOT NULL,
	"introduction_scope_accepted" boolean NOT NULL,
	"introduction_scope_version" text NOT NULL,
	"profile_consent_version" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"revision" uuid DEFAULT gen_random_uuid() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_basics_gender_check" CHECK ("profile_basics"."gender" IN ('male', 'female')),
	CONSTRAINT "profile_basics_age_check" CHECK ("profile_basics"."age" BETWEEN 19 AND 120),
	CONSTRAINT "profile_basics_region_check" CHECK ("profile_basics"."region" IN ('서울','경기','인천','부산','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'))
);
--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_profile_basics_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profile_basics"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_basics" ADD CONSTRAINT "profile_basics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;