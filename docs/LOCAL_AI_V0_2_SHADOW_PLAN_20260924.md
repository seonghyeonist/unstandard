# Local AI v0.2 — Synthetic-Prior Calibration and Shadow Plan

Date: 2026-09-24

## Status

This work is intentionally stacked on `feat/alpha-profile-identity-20260828` and is **not** a Production release change.

Current boundaries:

- Live app scoring remains `mock-local-heuristic-v0.0`.
- Local AI v0.2 is not wired into the Next.js unlock path.
- Qwen remains inactive and is not installed or required for this stage.
- No Preview/Production database migration is part of this stage.
- No default Neon branch or Production Vercel settings may be changed by this work.
- Human labeling is `WAIVED_BY_FOUNDER / NOT_PERFORMED` by procedure. This waiver is not ground truth and must never be converted into an accuracy or model-quality claim.

## Why v0.2 exists

The historical BGE-M3 technical PoC proved that the embedding-first architecture can run, but its synthetic-prior comparison exposed three product-relevant failure modes that must be treated separately from technical runtime success:

1. `AI_STYLED` answers were over-rewarded. Polished, generic, abstract prose could receive a high score without enough personal/situational grounding.
2. `SPAM_ABUSE` still produced false PASS decisions for some contact solicitation, self-promotion, repeated content, and irrelevant-answer patterns.
3. `ONBOARDING` was incorrectly interpreted as a depth-model classification problem even though product policy permits deliberately short, low-friction answers there.

## v0.2 policy changes

`services/depth-service` now contains the dormant v0.2 policy contract:

- adds `personal_grounding_score`;
- adds `ungrounded_abstract_penalty`;
- reduces the arbitrary reward for long Korean tokens;
- strengthens contact-solicitation, self-promotion, repeated-character, numeric-pattern, and explicit mismatch signals;
- routes a polished high-scoring but weakly grounded answer to `REVIEW` instead of auto-unlock;
- keeps hard spam/repetition/symbol-dominant cases fail-closed;
- versions the dormant scorer as `local-v0.2`.

The offline v0.2 benchmark additionally treats `ONBOARDING` as a product bypass:

```text
PASS / ONBOARDING_PASS / ONBOARDING_BYPASS
```

That outcome is **not** counted as evidence that the depth model understood or approved a short onboarding answer. It records only that the product flow must not use the depth gate for that context.

## Historical evidence stays immutable

`scripts/local-ai/helpers.py` and the historical 2026-08-04 v0.1 evidence remain unchanged for reproducibility.

The new policy lives in `scripts/local-ai/helpers_v02.py`, and the new operator-local benchmark lives in `scripts/local-ai/calibrate_v0_2.py`.

The v0.2 benchmark may read the approved local workbook only when its expected SHA-256 matches. It emits aggregate JSON only and must not emit or commit raw question/answer text, workbook row IDs, pair keys, embeddings, secrets, or model files.

## Synthetic-prior candidate checks

The v0.2 benchmark deliberately uses the term **synthetic design prior**, not human ground truth.

Candidate checks for this iteration are:

- `AI_STYLED` REVIEW rate >= 0.80
- `SPAM_ABUSE` REJECT rate >= 0.90
- `ONBOARDING` PASS/bypass rate == 1.00

It also reports overall and non-onboarding synthetic-prior agreement, category score/verdict distributions, BGE-M3 embedding health, latency, and threshold sweeps at `0.35 / 0.38 / 0.40 / 0.45`.

Possible aggregate verdicts are limited to:

- `V0_2_SYNTHETIC_PRIOR_CANDIDATE`
- `V0_2_NEEDS_TUNING`
- `V0_2_TECHNICAL_OR_INPUT_ISSUES`

None of these means human accuracy, user-safety validation, or Alpha readiness.

## How to run the next benchmark

Use an authorized operator-local runtime with the approved workbook and BGE-M3 dependencies installed outside the app dependency tree.

```bash
export UNSTANDARD_LABELING_WORKBOOK_PATH=/absolute/local/path/Unstandard_LabelingDataset_v0.1.xlsx
npm run poc:local-ai:v0.2-calibrate
```

The expected workbook hash is pinned in the harness. A mismatch must fail closed. The generated aggregate report stays local until it has been inspected for redaction; only a sanitized aggregate report may be committed afterward.

## Tests added in this stage

The stacked branch adds a dedicated `Local AI v0.2 CI` workflow. It does not download BGE-M3 or run the confidential workbook benchmark. It runs:

- the full existing Node app check and security/boundary guards;
- dormant depth-service Python tests;
- pure v0.2 policy tests;
- pure calibration-summary/threshold-sweep tests;
- Python compile checks for the offline harness.

This separates deterministic source-code correctness from the resource-heavy, operator-local BGE-M3 benchmark.

## Next stage after an acceptable v0.2 benchmark

Do **not** jump directly to Production scoring.

The next engineering stage is a separate shadow-integration branch with all of the following:

1. Reconcile the canonical Drizzle schema with the dormant depth-service persistence contract.
2. Design a canonical `answer_embeddings` / pgvector contract only if embeddings are actually retained server-side.
3. Add explicit deletion/cascade behavior for embeddings and depth evaluations.
4. Apply the schema only to a disposable or non-default Neon branch first.
5. Add a server-only authenticated shadow caller from the Next.js backend. No `NEXT_PUBLIC_*` selector, no client-visible token, and no user-visible scoring effect.
6. Keep `mock-local-heuristic-v0.0` authoritative for unlock decisions while shadow output is collected.
7. Log only the minimum aggregate/derived fields needed for comparison; do not log raw sensitive answers unnecessarily.
8. Define rollback as removal/disablement of the shadow caller without changing user-visible behavior.
9. Keep Qwen off until the deterministic BGE-M3 + feature policy is stable enough that a gray-band-only experiment is justified.

Only after that shadow stage has its own technical and behavioral evidence should a separate decision consider allowing Local AI to influence a limited cohort.
