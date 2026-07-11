-- 0004_onboarding_question_seed.sql
-- Seeds the alpha onboarding question used by mock data and DB-backed onboarding.
-- Reversible: DELETE FROM public.questions WHERE id = '22222222-2222-2222-2222-222222222222';

INSERT INTO public.questions (id, prompt, helper, active)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '요즘 당신을 작게 웃게 만든 장면은 뭐였나요?',
  '거창하지 않아도 좋아요. 2~4문장 정도면 충분해요.',
  true
)
ON CONFLICT (id) DO NOTHING;
