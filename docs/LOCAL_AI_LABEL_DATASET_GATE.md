# Local AI Label Dataset — Integrity & Human-Label Readiness Gate

## Verdict summary

| Gate | Verdict |
|---|---|
| `DATASET_INTEGRITY` | **`STRUCTURALLY_PASS`** — the hash-verified aggregate audit and an independent aggregate-only reconciliation both pass. The two earlier discrepancies were diagnostic-definition/counting errors, not workbook-integrity failures (see sections 3–4). |
| `CALIBRATION_READINESS` | **`NOT_READY`** |
| `HUMAN_LABEL_GATE` | **`BLOCKED`** |

`CALIBRATION_READINESS` and `HUMAN_LABEL_GATE` do **not** become ready merely
because a structural audit runs. They remain blocked by the absence of human
ground truth, which is an independent condition. A future `STRUCTURALLY_PASS`
integrity result would not unblock either of them.

## 1. Purpose and confidentiality boundary

This document fixes the data-handling rules and the human-labeling gate for the
offline label workbook that a future Local AI Depth Score calibration would use.
It is a **documentation-only** gate. It implements no model, no scoring, no
threshold and no calibration. See `docs/LOCAL_AI_POC_STATUS.md` for why the
Depth Score scaffold is `INACTIVE / NOT DEPLOYABLE`.

Confidentiality boundary — all of these are hard rules:

- The workbook **must never enter Git history**, in any branch, in any form
  (original, copy, rename, CSV/JSON export, fixture, or test asset).
- Question text, answer text, reviewer notes and whole rows **must never** be
  printed to stdout, written to logs, pasted into a commit, a PR body, an issue,
  a chat transcript, or an agent report.
- The workbook **must never** be uploaded, sent to any model, API, embedding
  service, or third party. That includes "just to count tokens" and "just to
  sanity-check formatting".
- Only **aggregate** statistics may leave the operator's machine — counts,
  distributions, and the boolean/derived checks listed in section 3.
- The workbook is delivered to any audit process by an **operator-local absolute
  path** in `UNSTANDARD_LABELING_WORKBOOK_PATH`. It is never copied into a
  repository worktree.

## 2. Source workbook

| Field | Value |
|---|---|
| Filename | `Unstandard_LabelingDataset_v0.1.xlsx` |
| Expected repository-relative location, **if it were ever placed near a checkout** | `project_sources/01-Unstandard_LabelingDataset_v0.1.xlsx` (git-ignored — see section 10) |
| Expected SHA-256 | `b63f77dc7fa10694e4af6d3fc5ee86c4fcb4b01bda0889a1e96bcba4b1a55e51` |
| Tracked in Git? | **No**, and it must stay untracked. |

Any audit run must verify the SHA-256 **before** parsing, and abort with
`INPUT: BLOCKED_INPUT_HASH_MISMATCH` on any mismatch. A workbook whose hash does
not match this value is a different artifact and its results are not
interchangeable with results recorded here.

## 3. Audit execution status

The real workbook was audited on **2026-07-27** after its SHA-256 matched the
value in section 2. The audit was read-only and aggregate-only: it printed no
question text, answer text, reviewer text, row IDs, pair digests, or matched
PII strings. The workbook was not copied into the Git worktree, modified,
exported, uploaded, or tracked.

Historical context: the original P0.4B documentation run could not access the
workbook and correctly left its observations as `_pending_`. That is no longer
the current audit state. The observations in section 4 are measurements from
the hash-verified workbook, not fixture output and not transcribed expectations.

A follow-up read-only, aggregate-only reconciliation was completed on
**2026-07-28** against the same hash-verified workbook. It resolved both prior
diagnostic discrepancies without altering the workbook or substituting observed
values:

- the phone diagnostic had double-counted the same five physical rows because
  two overlapping recognizers matched the same five occurrences;
- the raw-length expectation had overlooked answers containing no ASCII space,
  for which raw length and ASCII-space-removed length are necessarily equal.

The corrected metrics are recorded in section 4. The core container, row, ID,
distribution, duplicate, containment, and answer-length-invariant checks pass,
so `DATASET_INTEGRITY` is `STRUCTURALLY_PASS`. This does not change the
independent human-label or calibration gates.

## 4. Aggregate audit results

`expected` = the pre-audit assertion retained for traceability. `observed` = the
hash-verified workbook measurement, including the 2026-07-28 aggregate-only
reconciliation where noted. A divergence must be investigated rather than
overwritten; when the diagnostic itself is wrong, the correction and reason
must remain explicit.

### Container and structure

| Metric | Expected | Observed |
|---|---|---|
| Sheet count | 5 | 5 |
| Sheet names / visibility | 5, all visible | `📋 라벨링 세트`, `📊 분포 요약`, `🏷️ 레이블 가이드`, `⚙️ app_config 기준값`, `📈 KPI 트래킹`; all `visible` |
| Hidden / very-hidden sheets | 0 (all visible) | 0 (all visible) |
| Macro parts (`vbaProject.bin`) | 0 | 0 |
| External-link parts (`xl/externalLinks/`) | 0 | 0 |
| Formula cells | 0 | 0 |

### Rows and identifiers

| Metric | Expected | Observed |
|---|---|---|
| Populated labeling rows | 1000 | 1000 |
| ID range | 1..1000 | 1..1000 |
| IDs unique | yes | yes (1000 unique; 0 non-integer) |
| Unique question–answer pairs | 260 | 260 |
| Duplicate rows beyond unique pairs | 740 | 740 |

### Category distribution

| Category | Expected rows | Observed |
|---|---|---|
| `L1_PASS` | 100 | 100 |
| `L2_PASS` | 100 | 100 |
| `L3_PASS` | 150 | 150 |
| `L4_PASS` | 150 | 150 |
| `L5_PASS` | 150 | 150 |
| `GRAY_BAND` | 100 | 100 |
| `SPAM_ABUSE` | 100 | 100 |
| `AI_STYLED` | 50 | 50 |
| `ONBOARDING` | 100 | 100 |
| **Total** | **1000** | **1000** |

### Recommended label distribution (synthetic prior — see section 7)

| Recommended label | Expected rows | Observed |
|---|---|---|
| `PASS` | 750 | 750 |
| `REVIEW` | 150 | 150 |
| `REJECT` | 100 | 100 |

### Recommended path distribution (synthetic prior — see section 7)

| Recommended path | Expected rows | Observed |
|---|---|---|
| `BASIC` | 449 | 449 |
| `FAST_TRACK` | 201 | 201 |
| `GRAY_BAND` | 150 | 150 |
| `SPAM_REJECT` | 100 | 100 |
| `ONBOARDING_PASS` | 100 | 100 |

### Human-label completion

| Metric | Expected | Observed |
|---|---|---|
| Reviewer-1 labels completed | 0 | 0 |
| Reviewer-2 labels completed | 0 | 0 |
| Final labels completed | 0 | 0 |

### PII-shaped patterns

Counts and classification only. The matched strings must never be recorded.

| Metric | Expected | Observed |
|---|---|---|
| Phone-shaped physical rows | 5 | **5** |
| Phone-shaped match occurrences | 5 | **5** (answer field: 5; question field: 0) |
| Unique normalized question–answer pairs containing a match | not previously specified | **1** |
| Their category | all `SPAM_ABUSE` | all `SPAM_ABUSE` |
| Their recommended label | all `REJECT` | all `REJECT` |
| Their recommended path | all `SPAM_REJECT` | all `SPAM_REJECT` |

A physical row is counted once if either text field contains at least one match.
Overlapping recognizers must be unioned at row and occurrence level; their raw
per-recognizer counts must not be summed. The earlier value 10 double-counted the
same five occurrences because two recognizers matched each one. No matched text
was emitted or retained. All five physical rows are classified as
`SPAM_ABUSE` / `REJECT` / `SPAM_REJECT`; no classification-containment
exception was observed.

### Answer-length validation

The stored value is validated using **ASCII space U+0020 only**:

```python
len(answer.replace(" ", ""))
```

It is not raw Unicode length, `strip()` length, normalized-text length, or a
calculation with all Unicode whitespace removed.

| Metric | Expected | Observed |
|---|---:|---:|
| `stored == len(answer)` | 0 / 1000 (pre-audit assertion) | **145 / 1000** |
| Answers containing no ASCII space U+0020 | not previously specified | **145 / 1000** |
| Raw-length matches that contain an ASCII space | not previously specified | **0 / 1000** |
| `stored == len(answer.replace(" ", ""))` | 1000 / 1000 | **1000 / 1000** |
| Non-integer stored values | 0 | 0 |

The 145 raw-length matches are exactly the 145 answers containing no ASCII space,
so equality is required by the governing definition rather than anomalous. None
of the 855 answers containing an ASCII space matches raw length. The pre-audit
0/1000 assertion was therefore a diagnostic-definition error. The governing
ASCII-space-only answer-length invariant passes for every physical row.

### Duplicate structure

The largest observed repetition count for one normalized question–answer pair,
reported only by category, is: `L1_PASS` 5, `L2_PASS` 4, `L3_PASS` 5,
`L4_PASS` 5, `L5_PASS` 5, `GRAY_BAND` 2, `SPAM_ABUSE` 5, `AI_STYLED` 2, and
`ONBOARDING` 10. Pair grouping uses NFKC plus whitespace-insensitive text only
inside the ephemeral auditor; raw text, salts, and digests are not retained.

## 5. Reproducing the audit

Requirements: an isolated Python venv with `openpyxl`. **Do not** add a workbook
parsing dependency to the application's `package.json` or to
`services/depth-service/requirements.txt` — this tooling is operator-local and
must not become a runtime or CI dependency.

```bash
export UNSTANDARD_LABELING_WORKBOOK_PATH=/absolute/private/path/Unstandard_LabelingDataset_v0.1.xlsx
test -f "$UNSTANDARD_LABELING_WORKBOOK_PATH" || { echo "INPUT: BLOCKED_INPUT_FILE_NOT_FOUND"; exit 2; }
sha256sum "$UNSTANDARD_LABELING_WORKBOOK_PATH"
# must equal b63f77dc7fa10694e4af6d3fc5ee86c4fcb4b01bda0889a1e96bcba4b1a55e51

python3 -m venv /tmp/label-audit-venv
/tmp/label-audit-venv/bin/pip install openpyxl
/tmp/label-audit-venv/bin/python audit_label_workbook.py "$UNSTANDARD_LABELING_WORKBOOK_PATH"
```

The auditor script itself is **deliberately not committed** — this gate's change
allowlist is this document plus `.gitignore`, and an audit script that reads the
confidential workbook is operator tooling, not product code. It must satisfy these
requirements:

1. Verify SHA-256 before opening the file; abort on mismatch.
2. Inspect the `.xlsx` as a zip container for macro parts and external-link parts,
   rather than trusting the parsing library to surface them.
3. Emit only counts, distributions and booleans. Never emit cell text.
4. Reduce every free-text cell to a **per-run salted** SHA-256 digest before
   grouping, so that pair-identity can be counted without the digests being a
   stable fingerprint of any answer across runs.
5. Normalize text with NFKC and compare whitespace-stripped forms when computing
   pair identity, so that cosmetic whitespace does not inflate the unique count.
6. Report unmapped columns loudly rather than silently skipping them — a partially
   mapped sheet is an incomplete audit, not a passing one.

## 6. Physical rows vs. unique pairs

**The audited workbook contains 1,000 physical rows representing only 260 unique
question–answer pairs — roughly 3.85 physical rows per unique pair.**

This distinction is the single most important thing in this document.

- The 740 excess rows are **duplicates**, not independent observations.
- Any statistic computed over the 1,000 rows has an effective sample size closer
  to 260, and duplicated rows are not independent draws, so naive confidence
  intervals over 1,000 rows are wrong by construction.
- Sampling for human labeling must **deduplicate first** (section 8). Sampling
  1,000 rows would re-present the same pair to a reviewer up to five times,
  inflating apparent agreement and wasting reviewer effort.
- The phrase "1,000 labeled samples" is prohibited (section 9).

## 7. Answer-length counting semantics

The stored answer-length column equals the **character count after ASCII space
U+0020 only is removed**. The exact calculation is:

```python
len(answer.replace(" ", ""))
```

It is not raw Unicode string length, byte length, `strip()` length, normalized
text length, or a calculation that removes every Unicode whitespace character.
The audit checks raw length and the ASCII-space-only calculation separately in
section 4. The observed raw equality is 145/1000 because exactly 145 answers
contain no ASCII space; the ASCII-space-only invariant is 1000/1000.

Do not silently reinterpret this column as raw string length. If a future
consumer applies a minimum-length rule, it must use this same ASCII-space-only
definition and record that definition beside the rule.

## 8. Synthetic recommended labels vs. human final labels

The `권장 레이블` (recommended label) and `권장 경로` (recommended path) columns are a
**synthetic design prior** — they encode how the dataset's author intended each
category to be treated. They are **not human ground truth** and were not produced
by independent judgment of the individual answers.

Reviewer-1, reviewer-2 and final-label columns are all expected to be **empty**.
There is, at present, **no human ground truth in this workbook at all.**

It follows that comparing any model or heuristic against the recommended labels
yields, at most, an **offline synthetic-label disagreement proxy**. That number:

- is not accuracy,
- is not a false-unlock rate,
- is not a false-reject rate,
- is not a user-harm, report or block rate,
- and is not a production or alpha readiness signal.

Because the recommended labels were designed alongside the categories, a scorer
tuned to the category structure can score highly against them while being wrong
about real answers. High agreement here is close to self-confirmation and must
never be reported as validation.

## 9. Minimum human-label protocol

This protocol must be completed before any threshold calibration begins.

1. **Deduplicate before sampling.** Sample from the unique question–answer pairs,
   never from the 1,000 physical rows.
2. **Sample at least 200 unique pairs** of the expected 260.
3. **Stratify** across all nine categories and all question levels (`L1`–`L5`),
   so that `AI_STYLED` (the smallest stratum, ~13 unique pairs) and `GRAY_BAND`
   are represented rather than crowded out by the larger `L3`–`L5` strata.
4. **Two independent reviewers** label every sampled pair.
5. **Reviewers must not see the recommended label, recommended path, or category
   during initial judgment.** Blind the prior columns before handing over the
   review workbook; an unblinded reviewer measures the prior, not the answer.
6. **Reviewers must not see each other's labels** until both have finished.
7. **Every disagreement requires a recorded tie-break** producing an explicit
   final label, with the tie-break rationale recorded. An unresolved disagreement
   is not a final label.
8. **Report aggregate agreement and Cohen's kappa** for the two independent
   reviewers, computed *before* tie-breaking. Report kappa per category as well as
   overall — a good overall kappa can hide a category where reviewers disagree
   entirely.
9. **Keep the review workbook outside Git**, under the same confidentiality
   boundary as section 1.
10. **Do not start threshold calibration until at least 200 unique pairs carry a
    final label.** Partial completion does not partially unblock this gate.

Only after all ten conditions hold may `HUMAN_LABEL_GATE` move off `BLOCKED`, and
that transition must be recorded in this document with the observed counts and
kappa values.

## 10. Prohibited claims

None of the following may be stated in a commit, PR, report, document, or
investor/user-facing material on the basis of this workbook:

- "1,000 independent labeled samples" — there are ~260 unique pairs and, at
  present, zero human labels.
- "1,000-sample label set ready" / "labeling complete".
- "Calibration complete" or "thresholds calibrated".
- "Model accuracy measured".
- "False unlock rate measured" / "false reject rate measured".
- "User harm / report rate / block rate measured".
- "Local AI implemented", "Depth Score live", "PoC passed".
- "Production-ready" or "alpha-ready".

Alpha readiness is tracked separately in `docs/ALPHA_READINESS_CHECKLIST.md` and
is unaffected by anything in this document.

## 11. Git protection

`.gitignore` carries narrow entries for the exact workbook location and for the
private/derived data directories used by this workflow:

```gitignore
project_sources/01-Unstandard_LabelingDataset_v0.1.xlsx
private-data/local-ai/*.xlsx
artifacts/local-ai-labeling/raw/
```

These are intentionally **narrow**. A broad `*.xlsx` rule is not used: it would
silently hide any future legitimate spreadsheet and would make an accidental
commit of a *renamed* copy less likely to be noticed, not more. Ignoring is a
convenience, not the control — the control is that nobody copies the workbook
into a checkout in the first place.

Before any commit on a branch that touched this workflow:

```bash
git status --short
git diff --name-status
git ls-files | rg -i 'LabelingDataset|label.*xlsx|project_sources'   # expect: no output
```

## 12. Gate resolution and next gate

The two audit discrepancies are resolved in sections 3–4. The dataset is
`STRUCTURALLY_PASS`, but this is only an integrity verdict: it does not create
human ground truth and does not authorize calibration or model work.

The next minimum operational gate is **blind double-labeling of at least 200
deduplicated unique question–answer pairs, per section 9. It is not model
execution.**

Explicitly *not* next: TEI/BGE-M3/Qwen download or execution, Docker Compose
startup, embedding generation, threshold simulation, calibration, wiring the
depth service into the live app, or any deployment. Those remain gated behind
both this document and `docs/LOCAL_AI_POC_STATUS.md`.

The observed audit is complete. It does not unblock calibration, and no model
execution, deployment, or app change is authorized by this document.
