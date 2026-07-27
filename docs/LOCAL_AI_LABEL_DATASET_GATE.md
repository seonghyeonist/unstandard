# Local AI Label Dataset — Integrity & Human-Label Readiness Gate

## Verdict summary

| Gate | Verdict |
|---|---|
| `DATASET_INTEGRITY` | **`UNVERIFIED_IN_THIS_RUN`** — the audit could not be executed here (see "Audit execution status"). Not yet `STRUCTURALLY_PASS`. |
| `CALIBRATION_READINESS` | **`NOT_READY`** |
| `HUMAN_LABEL_GATE` | **`BLOCKED`** |

`CALIBRATION_READINESS` and `HUMAN_LABEL_GATE` do **not** depend on the outcome of
the structural audit. They are blocked by the absence of human ground truth, which
is an independent and stronger condition. A `STRUCTURALLY_PASS` integrity result
would not unblock either of them.

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

> **The aggregate audit has NOT been executed against the real workbook.**

The workbook was not reachable from the environment in which this gate was
written: `UNSTANDARD_LABELING_WORKBOOK_PATH` was unset, no file of that name
existed on the filesystem, and no file anywhere on disk matched the expected
SHA-256. The correct outcome is `BLOCKED_INPUT`, not a transcribed result.

Consequently the figures in section 4 are recorded as **operator-asserted
expectations, not reproduced measurements**. They are written down so that a
later run has something falsifiable to check against. Nobody may cite them as
audit evidence until the "observed" column is filled in by an actual run.

What *was* done instead: the auditor described in section 5 was written and
validated end-to-end against a **synthetic, shape-only fixture** containing no
real data. On that fixture the auditor reproduced every expected aggregate in
section 4 exactly. This establishes that the audit procedure is correct and
runnable; it establishes **nothing whatsoever** about the real workbook.

## 4. Aggregate audit results

`expected` = operator-asserted, unverified. `observed` = to be filled in by a run
against the hash-verified workbook. Do not delete the `expected` column when
filling in `observed`; a divergence is a finding, not something to overwrite.

### Container and structure

| Metric | Expected | Observed |
|---|---|---|
| Sheet count | 5 | _pending_ |
| Hidden / very-hidden sheets | 0 (all visible) | _pending_ |
| Macro parts (`vbaProject.bin`) | 0 | _pending_ |
| External-link parts (`xl/externalLinks/`) | 0 | _pending_ |
| Formula cells | 0 | _pending_ |

### Rows and identifiers

| Metric | Expected | Observed |
|---|---|---|
| Populated labeling rows | 1000 | _pending_ |
| ID range | 1..1000 | _pending_ |
| IDs unique | yes | _pending_ |
| Unique question–answer pairs | 260 | _pending_ |
| Duplicate rows beyond unique pairs | 740 | _pending_ |

### Category distribution

| Category | Expected rows | Observed |
|---|---|---|
| `L1_PASS` | 100 | _pending_ |
| `L2_PASS` | 100 | _pending_ |
| `L3_PASS` | 150 | _pending_ |
| `L4_PASS` | 150 | _pending_ |
| `L5_PASS` | 150 | _pending_ |
| `GRAY_BAND` | 100 | _pending_ |
| `SPAM_ABUSE` | 100 | _pending_ |
| `AI_STYLED` | 50 | _pending_ |
| `ONBOARDING` | 100 | _pending_ |
| **Total** | **1000** | _pending_ |

### Recommended label distribution (synthetic prior — see section 7)

| Recommended label | Expected rows | Observed |
|---|---|---|
| `PASS` | 750 | _pending_ |
| `REVIEW` | 150 | _pending_ |
| `REJECT` | 100 | _pending_ |

### Recommended path distribution (synthetic prior — see section 7)

| Recommended path | Expected rows | Observed |
|---|---|---|
| `BASIC` | 449 | _pending_ |
| `FAST_TRACK` | 201 | _pending_ |
| `GRAY_BAND` | 150 | _pending_ |
| `SPAM_REJECT` | 100 | _pending_ |
| `ONBOARDING_PASS` | 100 | _pending_ |

### Human-label completion

| Metric | Expected | Observed |
|---|---|---|
| Reviewer-1 labels completed | 0 | _pending_ |
| Reviewer-2 labels completed | 0 | _pending_ |
| Final labels completed | 0 | _pending_ |

### PII-shaped patterns

Counts and classification only. The matched strings must never be recorded.

| Metric | Expected | Observed |
|---|---|---|
| Phone-shaped rows | 5 | _pending_ |
| Their category | all `SPAM_ABUSE` | _pending_ |
| Their recommended label | all `REJECT` | _pending_ |
| Their recommended path | all `SPAM_REJECT` | _pending_ |

If any phone-shaped row is found **outside** `SPAM_ABUSE` / `REJECT` /
`SPAM_REJECT`, that is a containment finding and this gate must be re-opened
rather than annotated.

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

**The workbook is expected to contain 1,000 physical rows representing only 260
unique question–answer pairs — roughly 3.85 physical rows per unique pair.**

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

The stored answer-length column is expected to equal the **character count after
all whitespace is removed** — not the raw Unicode string length, and not a byte
length.

Any audit must check both interpretations and report them separately:

- `stored == len(answer)` — raw string length: expected **0** of 1000 matches.
- `stored == len("".join(answer.split()))` — whitespace-stripped: expected
  **1000** of 1000 matches.

Do not silently reinterpret this column as raw string length. If a future
consumer of the workbook applies a minimum-length rule, it must use the same
whitespace-stripped definition, or the rule will not mean what the workbook's
authors meant. Record which definition is in force wherever such a rule is
implemented.

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

## 12. Next gate

**The next action is human double-labeling of at least 200 unique question–answer
pairs, per section 9. It is not model execution.**

Explicitly *not* next: TEI/BGE-M3/Qwen download or execution, Docker Compose
startup, embedding generation, threshold simulation, calibration, wiring the
depth service into the live app, or any deployment. Those remain gated behind
both this document and `docs/LOCAL_AI_POC_STATUS.md`.

The immediately preceding blocking item is smaller: run the section-5 audit
against the hash-verified workbook and fill in the `observed` column of section 4,
so that `DATASET_INTEGRITY` can move off `UNVERIFIED_IN_THIS_RUN`. That is a
prerequisite for trusting the sampling frame in section 9, but it does not by
itself unblock calibration.
