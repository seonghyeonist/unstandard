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
- Human labeling review is `WAIVED_BY_FOUNDER / NOT_PERFORMED`. Workbook comparisons use only the synthetic design prior and are reported as `agreement_with_synthetic_prior` / an offline label-disagreement proxy.

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
- routes polished, abstract answers with weak personal grounding to `REVIEW`; repeated abstract-style cues plus weak grounding are reviewed even below the score threshold;
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

The v0.2 benchmark uses the term **synthetic design prior** and reports `agreement_with_synthetic_prior`; no human labels were collected.

Candidate checks for this iteration are:

- `AI_STYLED` REVIEW rate >= 0.80
- `SPAM_ABUSE` REJECT rate >= 0.90
- `ONBOARDING` PASS/bypass rate == 1.00

It also reports overall and non-onboarding synthetic-prior agreement, category score/verdict distributions, BGE-M3 embedding health, latency, and threshold sweeps at `0.35 / 0.38 / 0.40 / 0.45`.

Possible aggregate verdicts are limited to:

- `V0_2_SYNTHETIC_PRIOR_CANDIDATE`
- `V0_2_NEEDS_TUNING`
- `V0_2_TECHNICAL_OR_INPUT_ISSUES`

None of these represents a human-reviewed quality conclusion, user-safety validation, or Alpha readiness.

## Completed offline calibration (2026-09-24)

The approved workbook snapshot was verified before model execution: `ULDS-v0.1-b63f77dc-20260804`, SHA-256 `b63f77dc7fa10694e4af6d3fc5ee86c4fcb4b01bda0889a1e96bcba4b1a55e51`. All 1,000 physical rows normalized to 260 unique pairs; all 260 pairs were scored.

The real local model run used `BAAI/bge-m3`, revision `5617a9f61b028005a4858fdac845db406aefb181`, with model configuration SHA-256 `26159e7ad065073448460117eb24b7a4572f6f4e78eadff65dc0a11c052449fa` on CPU. Embeddings were 1,024-dimensional with 520 vectors produced, zero NaN/Inf values, and a two-run determinism probe with maximum absolute difference `0.0`. The final run's unique-pair latency was P50 `183.655 ms` / P95 `259.699 ms`.

| Run | AI_STYLED REVIEW | SPAM_ABUSE REJECT | ONBOARDING bypass PASS | Agreement with synthetic prior | Result |
|---|---:|---:|---:|---:|---|
| Initial v0.2 policy, threshold 0.38 | 4/30 (13.33%) | 19/20 (95%) | 10/10 (100%) | 113/260 (43.46%); non-onboarding 103/250 (41.20%) | `V0_2_NEEDS_TUNING` |
| Scalar penalty diagnostic, cutoff 0.45 | 8/30 (26.67%) | 19/20 (95%) | 10/10 (100%) | 117/260 (45.00%); non-onboarding 107/250 (42.80%) | `V0_2_NEEDS_TUNING` |
| Composite abstract-style rule, threshold 0.38 | 30/30 (100%) | 19/20 (95%) | 10/10 (100%) | 139/260 (53.46%); non-onboarding 129/250 (51.60%) | `V0_2_SYNTHETIC_PRIOR_CANDIDATE` |

The scalar-only sweep did not reach the `AI_STYLED` review target at any tested cutoff. The aggregate feature diagnostic showed at least two abstract-style cues and grounding below `0.45` across all `AI_STYLED` examples; the composite rule uses those signals directly and leaves unrelated categories on their existing rules. Deterministic regression tests cover the below-threshold review and concrete-grounding control case. This tuning is limited to the synthetic design prior; no human labels were collected.

The final canonical score-threshold sweep was `0.35 / 0.38 / 0.40 / 0.45`. All four settings met the three category checks after the composite rule. Their overall `agreement_with_synthetic_prior` rates were `66.15% / 53.46% / 47.69% / 40.00%`; the existing `0.38` threshold is retained. The report also contains verdict, path, score, threshold-band, reason-code, and safe numeric-feature aggregates for each category. Sanitized baseline, scalar-diagnostic, and final reports are committed under `docs/evidence/`.

This result is a v0.2 synthetic-prior candidate only. It is not a human-reviewed quality finding, does not authorize Local AI to affect unlock, and does not establish Closed Alpha readiness.

## How to run the benchmark again

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

## Shadow integration after the acceptable v0.2 benchmark

Do **not** jump directly to Production scoring.

The next engineering stage is a separate shadow-integration branch with all of the following:

1. Add a minimal canonical shadow-result table keyed to the existing `answers.id` UUID and existing canonical ID types; do not copy the legacy Docker PoC schema.
2. Persist only sanitized score, verdict, path, reason codes, allowlisted numeric/boolean features, model version, latency, and timestamp. Do not persist answer text or embeddings.
3. Apply and test the migration only on a disposable/non-default Neon branch, including constraints, cleanup, and deletion cascade.
4. Add a server-only authenticated shadow caller behind an explicit default-off feature gate. No `NEXT_PUBLIC_*` selector, client-visible token, or user-visible scoring effect.
5. Keep `mock-local-heuristic-v0.0` authoritative for unlock decisions. Shadow outcomes and outages must leave the same unlock result.
6. Define rollback as disabling/removing the shadow caller without changing user-visible behavior.
7. Keep Qwen off. Evaluate model-serving placement separately; do not run BGE-M3 inside an ordinary Vercel function without an approved compute/runtime assessment.

Only after that shadow stage has its own technical and behavioral evidence should a separate decision consider allowing Local AI to influence a limited cohort.
