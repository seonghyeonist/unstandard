CREATE TABLE "support_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"status" text NOT NULL,
	"assigned_to" text NOT NULL,
	"response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_events_status_check" CHECK ("support_events"."status" IN ('OPEN', 'IN_PROGRESS', 'CLOSED')),
	CONSTRAINT "support_events_response_check" CHECK ("support_events"."response" IS NULL OR char_length("support_events"."response") BETWEEN 10 AND 2000)
);
--> statement-breakpoint
ALTER TABLE "support_requests" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "support_events" ADD CONSTRAINT "support_events_ticket_id_support_requests_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_events_ticket_created_idx" ON "support_events" USING btree ("ticket_id","created_at");