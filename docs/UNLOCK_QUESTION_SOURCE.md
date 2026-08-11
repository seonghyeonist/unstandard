# Unlock question source

**Choice: Option B — Alpha-global active unlock question**

- Config key: `unlock.active_question_id`
- Value shape: `{ "questionId": "<uuid>" }`
- Seeded question id: `33333333-3333-4333-8333-333333333333`
- Distinct from onboarding question `22222222-2222-2222-2222-222222222222`

Database runtime never resolves unlock questions through mock `c1/c2/c3` lookups.
Hardcoded A/B email → UUID mapping is forbidden.
