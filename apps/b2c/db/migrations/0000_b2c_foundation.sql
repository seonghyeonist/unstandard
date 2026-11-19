CREATE SCHEMA "b2c";
--> statement-breakpoint
CREATE TABLE "b2c"."cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"round_id" uuid,
	"owner_member_id" uuid,
	"kind" text NOT NULL,
	"revision" integer NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "cards_scope" CHECK (("b2c"."cards"."kind" = 'personal' and "b2c"."cards"."owner_member_id" is not null and "b2c"."cards"."round_id" is null)
    or ("b2c"."cards"."kind" = 'shared' and "b2c"."cards"."owner_member_id" is null and "b2c"."cards"."round_id" is not null)),
	CONSTRAINT "cards_revision" CHECK ("b2c"."cards"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "b2c"."invites" (
	"token_digest" text PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invites_digest" CHECK ("b2c"."invites"."token_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "b2c"."jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_order_kind_revision" UNIQUE("order_id","kind","revision"),
	CONSTRAINT "jobs_attempts" CHECK ("b2c"."jobs"."attempts" between 0 and 3 and "b2c"."jobs"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "b2c"."members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"role" text NOT NULL,
	"locale" text NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "members_room_role" UNIQUE("room_id","role"),
	CONSTRAINT "members_room_id" UNIQUE("room_id","id"),
	CONSTRAINT "members_role" CHECK ("b2c"."members"."role" in ('buyer', 'partner')),
	CONSTRAINT "members_locale" CHECK ("b2c"."members"."locale" in ('en', 'ko')),
	CONSTRAINT "members_revision" CHECK ("b2c"."members"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "b2c"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_key" uuid NOT NULL,
	"sku" text NOT NULL,
	"usd_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"price_id" text NOT NULL,
	"provider_tx" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "orders_request_key_unique" UNIQUE("request_key"),
	CONSTRAINT "orders_provider_tx_unique" UNIQUE("provider_tx"),
	CONSTRAINT "orders_usd_only" CHECK ("b2c"."orders"."currency" = 'USD' and "b2c"."orders"."usd_cents" > 0),
	CONSTRAINT "orders_state" CHECK ("b2c"."orders"."state" in ('pending', 'paid', 'refunded', 'disputed')),
	CONSTRAINT "orders_paid_fields" CHECK ("b2c"."orders"."state" <> 'paid' or ("b2c"."orders"."paid_at" is not null and "b2c"."orders"."provider_tx" is not null))
);
--> statement-breakpoint
CREATE TABLE "b2c"."payment_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"provider_tx" text NOT NULL,
	"order_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "b2c"."rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "rooms_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "b2c"."rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"slots" jsonb NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	CONSTRAINT "rounds_room_id" UNIQUE("room_id","id"),
	CONSTRAINT "rounds_version" CHECK ("b2c"."rounds"."version" >= 0),
	CONSTRAINT "rounds_slots" CHECK (case when jsonb_typeof("b2c"."rounds"."slots") = 'array' then jsonb_array_length("b2c"."rounds"."slots") between 1 and 6 else false end)
);
--> statement-breakpoint
CREATE TABLE "b2c"."sessions" (
	"token_digest" text PRIMARY KEY NOT NULL,
	"member_id" uuid NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_digest" CHECK ("b2c"."sessions"."token_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "sessions_lifetime" CHECK ("b2c"."sessions"."expires_at" > "b2c"."sessions"."issued_at")
);
--> statement-breakpoint
CREATE TABLE "b2c"."submissions" (
	"room_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"tuples" jsonb NOT NULL,
	"share_version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "submissions_round_member" UNIQUE("round_id","member_id"),
	CONSTRAINT "submissions_tuples" CHECK (case when jsonb_typeof("b2c"."submissions"."tuples") = 'array' then jsonb_array_length("b2c"."submissions"."tuples") <= 36 else false end),
	CONSTRAINT "submissions_version" CHECK ("b2c"."submissions"."share_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "b2c"."votes" (
	"room_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"candidate_id" text NOT NULL,
	"revision" integer NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "votes_round_member" UNIQUE("round_id","member_id"),
	CONSTRAINT "votes_revision" CHECK ("b2c"."votes"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "b2c"."cards" ADD CONSTRAINT "cards_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "b2c"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."cards" ADD CONSTRAINT "cards_round_scope" FOREIGN KEY ("room_id","round_id") REFERENCES "b2c"."rounds"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."cards" ADD CONSTRAINT "cards_owner_scope" FOREIGN KEY ("room_id","owner_member_id") REFERENCES "b2c"."members"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."invites" ADD CONSTRAINT "invites_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "b2c"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."jobs" ADD CONSTRAINT "jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "b2c"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."members" ADD CONSTRAINT "members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "b2c"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."payment_events" ADD CONSTRAINT "payment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "b2c"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."rooms" ADD CONSTRAINT "rooms_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "b2c"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."rounds" ADD CONSTRAINT "rounds_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "b2c"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."sessions" ADD CONSTRAINT "sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "b2c"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."submissions" ADD CONSTRAINT "submissions_round_scope" FOREIGN KEY ("room_id","round_id") REFERENCES "b2c"."rounds"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."submissions" ADD CONSTRAINT "submissions_member_scope" FOREIGN KEY ("room_id","member_id") REFERENCES "b2c"."members"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."votes" ADD CONSTRAINT "votes_round_scope" FOREIGN KEY ("room_id","round_id") REFERENCES "b2c"."rounds"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c"."votes" ADD CONSTRAINT "votes_member_scope" FOREIGN KEY ("room_id","member_id") REFERENCES "b2c"."members"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cards_shared_revision" ON "b2c"."cards" USING btree ("round_id","kind","revision") WHERE "b2c"."cards"."kind" = 'shared';--> statement-breakpoint
CREATE UNIQUE INDEX "cards_personal_revision" ON "b2c"."cards" USING btree ("room_id","owner_member_id","revision") WHERE "b2c"."cards"."kind" = 'personal';--> statement-breakpoint
CREATE INDEX "cards_room" ON "b2c"."cards" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_one_open_per_room" ON "b2c"."invites" USING btree ("room_id") WHERE "b2c"."invites"."used_at" is null and "b2c"."invites"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "invites_room" ON "b2c"."invites" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "jobs_open_lease" ON "b2c"."jobs" USING btree ("lease_until") WHERE "b2c"."jobs"."finished_at" is null;--> statement-breakpoint
CREATE INDEX "payment_events_tx_time" ON "b2c"."payment_events" USING btree ("provider_tx","occurred_at");--> statement-breakpoint
CREATE INDEX "rooms_expiration" ON "b2c"."rooms" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_member" ON "b2c"."sessions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "sessions_expiration" ON "b2c"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "submissions_member_scope_idx" ON "b2c"."submissions" USING btree ("room_id","member_id");--> statement-breakpoint
CREATE INDEX "votes_member_scope_idx" ON "b2c"."votes" USING btree ("room_id","member_id");