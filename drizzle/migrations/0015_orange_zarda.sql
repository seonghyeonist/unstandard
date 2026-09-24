CREATE TABLE "local_ai_shadow_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unlock_attempt_id" uuid NOT NULL,
	"depth_score" numeric(6, 4) NOT NULL,
	"verdict" text NOT NULL,
	"path" text NOT NULL,
	"reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"personal_grounding_score" numeric(6, 4),
	"ungrounded_abstract_penalty" numeric(6, 4),
	"abstract_style_hits" integer,
	"relevance_score" numeric(6, 4),
	"specificity_score" numeric(6, 4),
	"repeat_pattern_penalty" numeric(6, 4),
	"emoji_symbol_penalty" numeric(6, 4),
	"spam_signature_penalty" numeric(6, 4),
	"model_version" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_ai_shadow_score_range" CHECK ("local_ai_shadow_evaluations"."depth_score" >= 0 AND "local_ai_shadow_evaluations"."depth_score" <= 1),
	CONSTRAINT "local_ai_shadow_verdict_allowed" CHECK ("local_ai_shadow_evaluations"."verdict" IN ('PASS', 'REVIEW', 'REJECT')),
	CONSTRAINT "local_ai_shadow_path_nonempty" CHECK (char_length("local_ai_shadow_evaluations"."path") BETWEEN 1 AND 48),
	CONSTRAINT "local_ai_shadow_reason_codes_bounded" CHECK (cardinality("local_ai_shadow_evaluations"."reason_codes") <= 32),
	CONSTRAINT "local_ai_shadow_model_version_bounded" CHECK (char_length("local_ai_shadow_evaluations"."model_version") BETWEEN 1 AND 160),
	CONSTRAINT "local_ai_shadow_latency_nonnegative" CHECK ("local_ai_shadow_evaluations"."latency_ms" >= 0),
	CONSTRAINT "local_ai_shadow_feature_ranges" CHECK ((
        ("local_ai_shadow_evaluations"."personal_grounding_score" IS NULL OR "local_ai_shadow_evaluations"."personal_grounding_score" BETWEEN 0 AND 1)
        AND ("local_ai_shadow_evaluations"."ungrounded_abstract_penalty" IS NULL OR "local_ai_shadow_evaluations"."ungrounded_abstract_penalty" BETWEEN 0 AND 1)
        AND ("local_ai_shadow_evaluations"."abstract_style_hits" IS NULL OR "local_ai_shadow_evaluations"."abstract_style_hits" BETWEEN 0 AND 64)
        AND ("local_ai_shadow_evaluations"."relevance_score" IS NULL OR "local_ai_shadow_evaluations"."relevance_score" BETWEEN 0 AND 1)
        AND ("local_ai_shadow_evaluations"."specificity_score" IS NULL OR "local_ai_shadow_evaluations"."specificity_score" BETWEEN 0 AND 1)
        AND ("local_ai_shadow_evaluations"."repeat_pattern_penalty" IS NULL OR "local_ai_shadow_evaluations"."repeat_pattern_penalty" BETWEEN 0 AND 1)
        AND ("local_ai_shadow_evaluations"."emoji_symbol_penalty" IS NULL OR "local_ai_shadow_evaluations"."emoji_symbol_penalty" BETWEEN 0 AND 1)
        AND ("local_ai_shadow_evaluations"."spam_signature_penalty" IS NULL OR "local_ai_shadow_evaluations"."spam_signature_penalty" BETWEEN 0 AND 1)
      ))
);
--> statement-breakpoint
ALTER TABLE "local_ai_shadow_evaluations" ADD CONSTRAINT "local_ai_shadow_evaluations_unlock_attempt_id_unlock_attempts_id_fk" FOREIGN KEY ("unlock_attempt_id") REFERENCES "public"."unlock_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "local_ai_shadow_attempt_model_unique" ON "local_ai_shadow_evaluations" USING btree ("unlock_attempt_id","model_version");--> statement-breakpoint
CREATE INDEX "local_ai_shadow_created_at_idx" ON "local_ai_shadow_evaluations" USING btree ("created_at");