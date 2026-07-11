-- 0005_answers_onboarding_hardening.sql
-- Additive hardening for onboarding answers persistence (apply after 0002 RLS).
-- Does not rewrite 0001-0004. Replaces permissive insert policies with stricter checks.
--
-- Preflight before apply: duplicate (user_id, question_id) rows will make the unique index fail.
--   SELECT user_id, question_id, COUNT(*) AS n
--   FROM public.answers
--   GROUP BY 1, 2
--   HAVING COUNT(*) > 1;

-- One onboarding answer per user per question at DB level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_user_question_unique
  ON public.answers (user_id, question_id);

-- Harden answers insert: own row only, cannot target another profile.
DROP POLICY IF EXISTS answers_insert_own ON public.answers;

CREATE POLICY answers_insert_own ON public.answers
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = target_profile_id
  );

-- Harden depth_evaluations insert: answer_id must belong to auth user.
DROP POLICY IF EXISTS depth_evaluations_insert_own ON public.depth_evaluations;

CREATE POLICY depth_evaluations_insert_own ON public.depth_evaluations
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.answers a
      WHERE a.id = answer_id
        AND a.user_id = auth.uid()
    )
  );
