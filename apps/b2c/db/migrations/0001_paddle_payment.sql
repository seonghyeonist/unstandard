CREATE TABLE "b2c"."payment_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "b2c"."recovery_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_digest" text NOT NULL,
	"order_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "recovery_tokens_token_digest_unique" UNIQUE("token_digest"),
	CONSTRAINT "recovery_digest" CHECK ("b2c"."recovery_tokens"."token_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD COLUMN "payment_mode" text;--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD COLUMN "checkout_locale" text;--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD COLUMN "purchase_digest" text;--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD COLUMN "purchase_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD COLUMN "purchase_revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD COLUMN "payment_customer_id" text;--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD COLUMN "payment_email_digest" text;--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD COLUMN "payment_review" text;--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD COLUMN "checkout_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "b2c"."recovery_tokens" ADD CONSTRAINT "recovery_tokens_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "b2c"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_rate_limits_expires" ON "b2c"."payment_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "recovery_order" ON "b2c"."recovery_tokens" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_payment_email" ON "b2c"."orders" USING btree ("payment_email_digest");--> statement-breakpoint
CREATE INDEX "orders_payment_pending" ON "b2c"."orders" USING btree ("created_at") WHERE "b2c"."orders"."state" = 'pending';--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD CONSTRAINT "orders_payment_mode" CHECK ("b2c"."orders"."payment_mode" in ('synthetic', 'sandbox'));--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD CONSTRAINT "orders_checkout_locale" CHECK ("b2c"."orders"."checkout_locale" in ('en', 'ko'));--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD CONSTRAINT "orders_purchase_digest" CHECK ("b2c"."orders"."purchase_digest" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "b2c"."orders" ADD CONSTRAINT "orders_email_digest" CHECK ("b2c"."orders"."payment_email_digest" ~ '^[0-9a-f]{64}$');