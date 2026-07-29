# P0.4F — Local AI Preflight Runbook (Without Execution)

## 0. Purpose

This runbook fixes the **preflight evidence, authorization, and stop
procedures** that a future founder-authorized Local AI task must satisfy
**before** any model download or execution.

It is **repository-only documentation**. Completing or merging this document
does **not**:

- authorize Local AI execution;
- authorize model download (TEI, BGE-M3, Qwen, Ollama, or otherwise);
- authorize calibration, temperature sweep, or benchmark;
- promote `HUMAN_LABEL_GATE`, `CALIBRATION_READINESS`, or alpha readiness;
- change Production, DB, Preview, or Vercel.

When this document appears to conflict with
`docs/P0_4D_AI_ADJUDICATION_CURSOR_WORKSHEET.md`,
`docs/P0_4E_LOCAL_AI_PROVENANCE_AND_GATE_BOUNDARY.md`,
`docs/LOCAL_AI_LABEL_DATASET_GATE.md`,
`docs/LOCAL_AI_POC_STATUS.md`, or
`docs/ALPHA_READINESS_CHECKLIST.md`, preserve the **stricter** safety and
provenance rule and stop for founder direction.

## 1. Current status (do not elevate here)

| Item | Current status |
|---|---|
| AI offline adjudication | `RECORDED` |
| Human ground truth | `ABSENT` / `NOT ESTABLISHED` |
| `HUMAN_LABEL_GATE` | `BLOCKED` |
| Local AI execution | `NOT_RUN` |
| Calibration | `NOT_READY` |
| Alpha readiness | `NOT_AUTHORIZED` |
| Production / DB / Vercel | `UNTOUCHED` |

### Naming map (preserve meaning; do not overwrite other docs)

| This runbook | Existing document phrasing |
|---|---|
| Human ground truth `ABSENT` / `NOT ESTABLISHED` | P0.4E: `ABSENT`; P0.4D: `NOT ESTABLISHED` |
| Local AI execution `NOT_RUN` | P0.4E: `NOT_RUN`; `docs/LOCAL_AI_POC_STATUS.md`: `INACTIVE / NOT DEPLOYABLE` |
| Calibration `NOT_READY` | `CALIBRATION_READINESS` = `NOT_READY` |
| Alpha readiness `NOT_AUTHORIZED` | `docs/ALPHA_READINESS_CHECKLIST.md`: `BLOCKED_EXTERNAL` |
| AI offline adjudication `RECORDED` | P0.4D/P0.4E: offline AI A/B + third-AI adjudication recorded as provenance only |

## 2. Provenance vs executable dataset (hard separation)

Cite only aggregates already recorded in P0.4D / P0.4E. Do not invent new
counts or hashes.

From `docs/P0_4D_AI_ADJUDICATION_CURSOR_WORKSHEET.md` /
`docs/P0_4E_LOCAL_AI_PROVENANCE_AND_GATE_BOUNDARY.md`:

| Provenance field | Recorded value |
|---|---|
| AI A/B sample | 200 |
| A/B agreements / disagreements | 154 / 46 |
| Raw agreement / Cohen's kappa | 77.0% / 0.58037 |
| Third-AI queue | PASS 18 / REVIEW 2 / REJECT 26 |
| Combined 200-row offline view | PASS 65 / REVIEW 9 / REJECT 126 |
| Adjudicated workbook SHA-256 | `4286855406f887f83c71392b4ab5ec8412b136b3275b209a643796da9180c377` |

Hard rules:

1. The adjudicated workbook SHA-256 is **provenance evidence only**.
2. That workbook is **not** an authorized Local AI execution dataset merely
   because its hash is recorded.
3. **Do not** reuse the provenance workbook hash as an executable dataset
   snapshot hash.
4. A future execution requires a **separate** dataset snapshot ID and SHA-256
   (operator-local; never committed).
5. Question/answer text and XLSX **must not** enter the repository.
6. AI adjudication remains **not** human ground truth.

## 3. Future preflight manifest (fields only — do not fill or run)

For a separately authorized Local AI task, record a preflight manifest with at
least these fields **before** download or execution. Leave values empty in this
document; do not invent them here.

```text
founder_authorization_id:
founder_authorization_date:
founder_authorization_scope:

work_branch:
base_sha:
head_sha:

dataset_snapshot_id:
dataset_snapshot_sha256:

model_name:
model_version:
model_file_hash:

runtime_info:
hardware_info:

prompt_or_template_version:
prompt_or_template_hash:

seed:
execution_timestamp:

input_artifact_id:
input_artifact_hash:
output_artifact_id:
output_artifact_hash:

isolation_info:
secret_redaction_confirmed: yes/no

calibration_evaluation_definition: (if calibration is in scope)
failure_and_stop_conditions:
rollback_or_discard_procedure:
production_and_db_isolated: yes/no
```

This section does **not** authorize filling these fields against live systems
in the present task.

## 4. Gate transition rules (documentation alone never transitions)

Document authorship, P0.4D recording, P0.4E boundary docs, and this P0.4F
runbook **do not** perform any of the following transitions:

| From | To | Not triggered by this runbook |
|---|---|---|
| `NOT_AUTHORIZED` | `EXECUTION_ALLOWED` | Local AI execution remains unauthorized |
| `NOT_READY` | `CALIBRATION_READY` | Calibration remains not ready |
| `NOT_AUTHORIZED` | `ALPHA_READY` | Alpha readiness remains unauthorized |

Each transition, if ever considered later, requires **all** of:

1. Explicit founder authorization for that exact transition.
2. Approved branch and verified SHAs.
3. Approved dataset snapshot (separate from provenance-only workbook reuse).
4. Model and runtime provenance (name, version, hashes, isolation).
5. Execution results and artifact hashes (aggregate-safe).
6. A separate calibration evaluation definition (for calibration transitions).
7. A separate readiness review (for alpha / readiness transitions).

AI adjudication records alone never promote gates.

## 5. Immediate stop conditions → `BLOCKED`

Stop immediately and report `BLOCKED` if any of the following hold:

- base SHA mismatch against the authorized task;
- branch or PR scope mismatch;
- missing dataset snapshot hash;
- missing model hash;
- unclear founder authorization scope;
- secret redaction cannot be guaranteed;
- Production / DB isolation cannot be guaranteed;
- a request requires storing raw question/answer text in the repository;
- artifact provenance cannot be verified;
- calibration evaluation definition is missing when calibration is requested;
- an instruction demands readiness promotion without a separate authorized
  readiness review.

## 6. Required startup sequence for the next Cursor session

1. Read `AGENTS.md`.
2. Read `docs/P0_4D_AI_ADJUDICATION_CURSOR_WORKSHEET.md`.
3. Read `docs/P0_4E_LOCAL_AI_PROVENANCE_AND_GATE_BOUNDARY.md`.
4. Read this file: `docs/P0_4F_LOCAL_AI_PREFLIGHT_RUNBOOK.md`.
5. Verify branch / base / HEAD SHA against the authorized task.
6. Verify gate statuses in section 1 and related gate documents.
7. Confirm founder authorization and exact scope.
8. If the request exceeds authorization → report `BLOCKED` and stop.
9. Before any Local AI execution (only if separately authorized): record the
   preflight manifest and hashes first.
10. After any authorized execution: keep calibration and readiness as
    **separate** gates; do not auto-promote them.

## 7. Explicitly prohibited inferences from P0.4F

Do not infer authorization for:

- downloading or running Local AI models;
- starting Docker / Ollama / TEI / sidecars;
- calibration, temperature sweep, or benchmark;
- committing XLSX or row-level text;
- changing thresholds, unlock behavior, DB, Preview, Production, or Vercel;
- declaring `HUMAN_LABEL_GATE`, `CALIBRATION_READINESS`, or alpha readiness
  passed.

Default next work remains repository-only documentation and provenance
maintenance until a separate founder authorization explicitly expands scope.

## 8. Relationship to other gates

This runbook supplements, and does not replace:

- `docs/P0_4D_AI_ADJUDICATION_CURSOR_WORKSHEET.md`
- `docs/P0_4E_LOCAL_AI_PROVENANCE_AND_GATE_BOUNDARY.md`
- `docs/LOCAL_AI_LABEL_DATASET_GATE.md`
- `docs/LOCAL_AI_POC_STATUS.md`
- `docs/ALPHA_READINESS_CHECKLIST.md`
- `AGENTS.md`

P0.4F is a preflight **procedure template**, not execution authorization,
not calibration readiness, and not alpha readiness.
