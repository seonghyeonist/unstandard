-- 0002_rls_policies.sql
-- Unstandard RLS draft — ENABLE on all private tables before alpha

-- Helper: current auth uid
-- auth.uid() used in all policies

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_public ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- profile_private — only owner reads/writes; unlock visibility via separate policy later
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_private_select_own ON public.profile_private
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY profile_private_insert_own ON public.profile_private
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY profile_private_update_own ON public.profile_private
  FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- TODO post-unlock: policy for viewer when unlocks row exists for (viewer, profile_id)

-- questions — read active only
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY questions_select_active ON public.questions
  FOR SELECT USING (active = true);

-- answers — own rows only
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY answers_select_own ON public.answers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY answers_insert_own ON public.answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY answers_update_own ON public.answers
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- depth_evaluations — own only; scoring internals not global
ALTER TABLE public.depth_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY depth_evaluations_select_own ON public.depth_evaluations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY depth_evaluations_insert_own ON public.depth_evaluations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- reports — create own; read own only; no update/delete for normal users
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY reports_select_own ON public.reports
  FOR SELECT USING (auth.uid() = reporter_user_id);

-- blocks — own block list
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocks_select_own ON public.blocks
  FOR SELECT USING (auth.uid() = blocker_user_id);

CREATE POLICY blocks_insert_own ON public.blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_user_id);

CREATE POLICY blocks_delete_own ON public.blocks
  FOR DELETE USING (auth.uid() = blocker_user_id);

-- app_config — read safe subset for authenticated users; no write
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_config_select_authenticated ON public.app_config
  FOR SELECT TO authenticated
  USING (
    key IN (
      'onboarding_q_count',
      'waitlist_content_enabled',
      'waitlist_q_count',
      'thinker_badge_visible_delay'
    )
  );

-- events — own only; minimize payload PII at application layer
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_select_own ON public.events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY events_insert_own ON public.events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- unlocks — viewer sees own unlock state
ALTER TABLE public.unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY unlocks_select_own ON public.unlocks
  FOR SELECT USING (auth.uid() = viewer_user_id);

CREATE POLICY unlocks_insert_own ON public.unlocks
  FOR INSERT WITH CHECK (auth.uid() = viewer_user_id);

-- conversations / messages — members only
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_members_select_own ON public.conversation_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY messages_select_member ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY messages_insert_member ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = author_user_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

-- Admin / service role bypasses RLS — never use in browser client
