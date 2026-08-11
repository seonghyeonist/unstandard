ALTER TABLE "rate_limits" DROP CONSTRAINT "rate_limits_pkey";--> statement-breakpoint
ALTER TABLE "rate_limits" ADD COLUMN "id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_key_unique" UNIQUE("key");
