# UNSTANDARD canonical-domain audit — 2026-08-21

**Decision state:** `BLOCKED`
**Scope:** Stage 1 screening evidence; not trademark clearance or legal advice.

## Current observations

| Gate | Observation | Verdict |
|---|---|---|
| Production binding | Vercel Production deployment `dpl_BLnfemiNBTxhkEfPZTzVz65KReY8` lists `unstandard.app` and `www.unstandard.app` as aliases. | `OBSERVED` |
| Domain acquisition | Connected Vercel checker reports `unstandard.app` unavailable for purchase. Registrar receipt/ownership record was not available to this workspace. | `BLOCKED_EXTERNAL` |
| Exact Korean mark | KIPRIS trademark-name query `UNSTANDARD`, domestic scope, returned `0`. | `SCREENING_ONLY` |
| Exact Korean spelling | KIPRIS trademark-name query `언스탠다드`, domestic scope, returned `0`. | `SCREENING_ONLY` |
| Similar spelling | KIPRIS wildcard query `UNSTAND*` returned domestic `0` and overseas results. Overseas records were not reviewed as a complete class-scoped clearance. | `COUNSEL_REVIEW_REQUIRED` |
| Social handles | No founder-approved exact platform matrix or verified ownership evidence was available. Public search surfaced unrelated uses including `unstd.clothing`. | `BLOCKED_EXTERNAL` |
| Pronunciation/confusion | “un-standard” is readable, but `nonstandard`, `substandard`, and existing unrelated uses remain possible confusion vectors. No five-person target-user spelling test is recorded. | `BLOCKED_USER_TEST` |

## Search record

- Date: 2026-08-21, Asia/Seoul.
- Official database: [KIPRIS](https://www.kipris.or.kr/), trademark tab,
  domestic scope, trademark-name field.
- Queries: `UNSTANDARD`, `언스탠다드`, `UNSTAND*`.
- Relevant public collision observations: [Unstandard Clothing](https://www.unstd.in/),
  [Unstandard Clothing Instagram](https://www.instagram.com/unstd.clothing/),
  and [UnStandard music release](https://ferencnemeth.bandcamp.com/album/unstandard).

## Required closure

1. Founder supplies registrar acquisition/ownership evidence without exposing
   account credentials.
2. Counsel defines jurisdictions and Nice classes for dating/social service and
   software/SaaS, then reviews exact, phonetic, spacing, abbreviation, and
   confusingly similar marks.
3. Founder approves an exact handle matrix for Instagram, Threads, X, YouTube,
   and TikTok where relevant; record available/owned/conflicting/waived status.
4. Run a small pronunciation/spelling test and record only aggregate outcomes.
5. Populate the v4 domain fields only after all four parts are evidenced. Do
   not change `trademarkReview` to `NO_BLOCKING_CONFLICT_FOUND` from this
   screening alone.

