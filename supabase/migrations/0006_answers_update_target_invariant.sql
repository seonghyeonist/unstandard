-- 0006_answers_update_target_invariant.sql
-- Hardens answers UPDATE so owners cannot retarget target_profile_id to another user.
-- Required after 0005 INSERT hardening: without this, INSERT WITH CHECK can be bypassed via UPDATE.
--
-- Merge blocker if absent: User A can UPDATE own answer SET target_profile_id = User B.

DROP POLICY IF EXISTS answers_update_own ON public.answers;

CREATE POLICY answers_update_own ON public.answers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = target_profile_id
  );
