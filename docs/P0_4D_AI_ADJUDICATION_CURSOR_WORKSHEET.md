# P0.4D AI Adjudication — Cursor Continuity Worksheet

## 0. Read this before continuing dataset or Local AI work

This worksheet is an operational handoff for Cursor and other coding agents.

It records an **AI-only offline adjudication result**. It does not create human
ground truth, does not authorize model calibration, and does not change the
runtime or deployment status.

The original P0.4B Local AI gate remains authoritative unless this worksheet
explicitly says otherwise. When the two documents appear to conflict, preserve
the stricter safety and provenance rule and stop for founder direction.

## 1. Current status

| Gate | Status |
|---|---|
| P0.4D workbook structural integrity | `PASS` |
| AI A/B independent labeling | `COMPLETE` |
| Third-AI disagreement adjudication | `COMPLETE` |
| Human ground truth | `NOT ESTABLISHED` |
| `HUMAN_LABEL_GATE` | `BLOCKED` |
| `CALIBRATION_READINESS` | `NOT_READY` |
| Local AI Depth Score PoC | `INACTIVE / NOT DEPLOYABLE` |
| Alpha readiness | `BLOCKED_EXTERNAL` |

Founder operating decision recorded on 2026-07-28: the human labeling exercise is
skipped because of the labeling volume. This is an operating decision, not a
claim that AI labels are equivalent to human labels.

## 2. Evidence identity

The adjudicated workbook is operator-local and must not enter Git history.

| Field | Value |
|---|---|
| Artifact | `P0.4D_AI_AB_Adjudicated_Final.xlsx` |
| SHA-256 | `4286855406f887f83c71392b4ab5ec8412b136b3275b209a643796da9180c377` |
| Workbook queue rows | 46 |
| Full comparison rows | 200 |
| Raw question/answer text in this document | No |

Before using the workbook again, verify the SHA-256. A mismatch means a different
artifact and its results are not interchangeable.

## 3. Aggregate result

No question, answer, reviewer note, phone number, email, or row-level text may
be copied into a commit, PR, issue, log, chat report, or agent output.

### Independent A/B comparison

| Metric | Value |
|---|---:|
| Reviewer A: PASS / REVIEW / REJECT | 56 / 20 / 124 |
| Reviewer B: PASS / REVIEW / REJECT | 53 / 30 / 117 |
| Agreements | 154 |
| Disagreements | 46 |
| Raw agreement | 77.0% |
| Expected agreement | 45.19% |
| Cohen's kappa | 0.58037 |

### Third-AI adjudication queue

| Final label | Count |
|---|---:|
| PASS | 18 |
| REVIEW | 2 |
| REJECT | 26 |
| Total | 46 |

Adjudication reason counts:

| Reason code | Count |
|---|---:|
| CLEAR_VALUE | 8 |
| IRRELEVANT | 20 |
| PERSONAL_CONTEXT | 4 |
| BORDERLINE_DEPTH | 1 |
| SHORT_ANSWER | 6 |
| CONCRETE_EXAMPLE | 6 |
| AMBIGUOUS_RELEVANCE | 1 |

### Combined 200-row offline label view

Agreement rows retain the shared A/B label. Disagreement rows use the third-AI
final label.

| Final label | Count |
|---|---:|
| PASS | 65 |
| REVIEW | 9 |
| REJECT | 126 |
| Total | 200 |

These are **offline AI adjudication counts**. They are not accuracy, calibration,
false-unlock rate, false-reject rate, user-harm rate, report rate, block rate,
production evidence, or alpha-readiness evidence.

## 4. Integrity checks already completed

The following checks passed against the local final workbook:

- exactly three expected sheets: `Summary`, `Adjudication Queue`, `Comparison`;
- 46 queue rows;
- 46 unique queue IDs;
- no blank or invalid final labels;
- no blank or invalid adjudication notes;
- the queue ID set exactly equals the 46 A/B disagreement IDs;
- all 200 comparison rows are present;
- all agreement rows retain their common A/B label;
- all disagreement rows have a populated third-AI final label;
- source columns and row order are preserved;
- no formula-error matches were found.

## 5. Confidentiality and provenance rules

The workbook and all derivative row-level material remain operator-local.

Never:

- commit, upload, or copy the workbook into the repository;
- export its rows to CSV, JSON, fixtures, tests, or markdown;
- send question/answer text to a model, API, embedding service, or third party;
- print row IDs together with raw text in logs or reports;
- modify the source workbook or silently replace its SHA;
- describe AI labels as human labels or ground truth;
- use the combined counts as a production quality or safety metric.

Aggregate counts and artifact hashes are permitted for traceability. The file path
must be supplied through an operator-local absolute path when a future local
audit needs it.

## 6. What Cursor must do on a future session

1. Read this worksheet and `docs/LOCAL_AI_LABEL_DATASET_GATE.md`.
2. Check the active branch, exact HEAD, and worktree status before editing.
3. Verify the local artifact hash before parsing any workbook.
4. Keep all workbook processing aggregate-only.
5. Keep runtime, Preview, Production, DB migrations, and deployment untouched
   unless the founder gives a separate explicit authorization.
6. If a task asks for model calibration, first report that human ground truth is
   absent and ask whether an **AI-only offline proxy experiment** is explicitly
   authorized.
7. If such an experiment is authorized, keep it isolated from the live app and
   report only aggregate offline results with the artifact hash and exact
   evaluation definition.
8. Run the repository's required static checks for any code or documentation
   change, then report the exact branch and commit.

## 7. Explicitly prohibited next steps without new authorization

Do not infer authorization for any of the following from P0.4D completion:

- downloading TEI, BGE-M3, Qwen, or other model assets;
- starting Docker or a Local AI sidecar;
- generating embeddings or sending raw text to any remote service;
- changing thresholds, weights, `SDS`, `Fast-track`, or unlock behavior;
- wiring the Depth Score service into Next.js, Preview, or Production;
- applying migrations, changing Neon or any retired hosted-BaaS data, or deploying;
- declaring `CALIBRATION_READINESS`, `HUMAN_LABEL_GATE`, or alpha readiness
  passed.

The next safe default is repository-only documentation and provenance
maintenance. A model benchmark is a separate founder-approved task.

## 8. Completion report template

Use this template for future work. Do not add row-level examples.

```text
RESULT: PASS | BLOCKED

branch:
head:
scope:
artifact_sha256:
raw_text_printed: no
workbook_uploaded_or_committed: no
human_ground_truth_claimed: no
runtime_or_deployment_touched: no

checks:
- exact source artifact hash:
- aggregate-only output:
- repository checks:
- blocker:
```

## 9. Relationship to existing gates

This worksheet supplements, but does not replace:

- `docs/LOCAL_AI_LABEL_DATASET_GATE.md`
- `docs/LOCAL_AI_POC_STATUS.md`
- `docs/ALPHA_READINESS_CHECKLIST.md`
- `AGENTS.md`

The existing Local AI gate's human-label and calibration requirements remain
unmet. The AI-only adjudication is useful as a documented offline proxy and
continuity artifact, not as a scientific or launch gate.
