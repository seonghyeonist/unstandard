CREATE TABLE "identity_provider_purge_queue" (
  "request_id" uuid PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "provider_reference" text NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "queued_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "identity_provider_purge_queue_attempt_count_check" CHECK ("attempt_count" >= 0),
  CONSTRAINT "identity_provider_purge_queue_provider_check" CHECK ("provider" = 'didit-v3'),
  CONSTRAINT "identity_provider_purge_queue_reference_check" CHECK ("provider_reference" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
);
--> statement-breakpoint
CREATE INDEX "identity_provider_purge_queue_provider_reference_idx" ON "identity_provider_purge_queue" USING btree ("provider_reference");--> statement-breakpoint
CREATE INDEX "identity_provider_purge_queue_next_attempt_idx" ON "identity_provider_purge_queue" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE FUNCTION public."queue_identity_provider_purge"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."provider" = 'didit-v3'
    AND OLD."provider_reference" IS NOT NULL
    AND OLD."provider_purged_at" IS NULL THEN
    INSERT INTO public."identity_provider_purge_queue" ("request_id", "provider", "provider_reference")
    VALUES (OLD."request_id", OLD."provider", OLD."provider_reference")
    ON CONFLICT ("request_id") DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "identity_verifications_queue_provider_purge"
AFTER DELETE ON public."identity_verifications"
FOR EACH ROW EXECUTE FUNCTION public."queue_identity_provider_purge"();