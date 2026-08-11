CREATE TABLE "unlock_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"viewer_user_id" text NOT NULL,
	"target_profile_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_text" text NOT NULL,
	"verdict" text NOT NULL,
	"score" numeric(6, 4),
	"path" text,
	"reason_codes" text[] DEFAULT '{}'::text[],
	"model_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unlock_attempts_answer_len" CHECK (char_length(answer_text) >= 1 AND char_length(answer_text) <= 2000),
	CONSTRAINT "unlock_attempts_verdict_check" CHECK (verdict IN ('PASS', 'REVIEW', 'REJECT', 'ERROR'))
);
--> statement-breakpoint
ALTER TABLE "unlock_attempts" ADD CONSTRAINT "unlock_attempts_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "unlock_attempts" ADD CONSTRAINT "unlock_attempts_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "unlock_attempts" ADD CONSTRAINT "unlock_attempts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "unlock_attempts_viewer_user_id_idx" ON "unlock_attempts" USING btree ("viewer_user_id");
--> statement-breakpoint
CREATE INDEX "unlock_attempts_target_profile_id_idx" ON "unlock_attempts" USING btree ("target_profile_id");
--> statement-breakpoint
CREATE INDEX "unlock_attempts_viewer_target_created_idx" ON "unlock_attempts" USING btree ("viewer_user_id","target_profile_id","created_at");
