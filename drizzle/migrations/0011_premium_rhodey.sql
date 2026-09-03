ALTER TABLE "identity_verifications" DROP CONSTRAINT "identity_status_check";--> statement-breakpoint
ALTER TABLE "identity_verifications" DROP CONSTRAINT "identity_result_check";--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD COLUMN "provider_reference" text;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD COLUMN "biometric_consent_version" text;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD COLUMN "provider_purged_at" timestamp with time zone;--> statement-breakpoint
-- Existing provider-era rows have no Didit consent or provider purge proof. Invalidate
-- their old verification evidence instead of inferring consent or copying a result.
UPDATE "identity_verifications"
SET "status" = 'pending', "verified_at" = NULL, "biometric_consent_version" = 'legacy-invalidated-v1';--> statement-breakpoint
ALTER TABLE "identity_verifications" ALTER COLUMN "biometric_consent_version" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "identity_verifications_provider_reference_unique" ON "identity_verifications" USING btree ("provider_reference");--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_provider_reference_check" CHECK ("identity_verifications"."status" = 'pending' OR "identity_verifications"."provider_reference" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_status_check" CHECK ("identity_verifications"."status" IN ('pending', 'verified_unpurged', 'verified'));--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_result_check" CHECK ((
    ("identity_verifications"."status" = 'pending' AND "identity_verifications"."verified_at" IS NULL AND "identity_verifications"."provider_purged_at" IS NULL)
    OR ("identity_verifications"."status" = 'verified_unpurged' AND "identity_verifications"."verified_at" IS NOT NULL AND "identity_verifications"."provider_purged_at" IS NULL)
    OR ("identity_verifications"."status" = 'verified' AND "identity_verifications"."verified_at" IS NOT NULL AND "identity_verifications"."provider_purged_at" IS NOT NULL)
  ));
