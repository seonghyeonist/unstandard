ALTER TABLE "alpha_invites" ADD COLUMN "balance_consent_version" text;--> statement-breakpoint
ALTER TABLE "alpha_invites" ADD COLUMN "balance_consented_on" date;--> statement-breakpoint
ALTER TABLE "alpha_invites" ADD CONSTRAINT "alpha_invites_balance_consent_check" CHECK ((
        ("alpha_invites"."balance_bucket" IN ('bucket_a', 'bucket_b')
          AND "alpha_invites"."balance_consent_version" = 'stage1-role-preference-v1'
          AND "alpha_invites"."balance_consented_on" IS NOT NULL)
        OR
        ("alpha_invites"."balance_bucket" = 'not_counted'
          AND "alpha_invites"."balance_consent_version" IS NULL
          AND "alpha_invites"."balance_consented_on" IS NULL)
      ));