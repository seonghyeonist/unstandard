# P0.4E — Local AI Provenance & Gate Boundary

## 0. Purpose

This worksheet fixes the **operational boundary** between:

- the completed P0.4D **AI-only offline adjudication** provenance, and
- the still-blocked Local AI execution, human-label, calibration, and alpha
  readiness gates.

It is **repository-only documentation**. It does not authorize Local AI
execution, model download, calibration, threshold changes, DB work, Preview,
Production, or Vercel changes.

When this document appears to conflict with
`docs/LOCAL_AI_LABEL_DATASET_GATE.md`,
`docs/LOCAL_AI_POC_STATUS.md`,
`docs/P0_4D_AI_ADJUDICATION_CURSOR_WORKSHEET.md`, or
`docs/ALPHA_READINESS_CHECKLIST.md`, preserve the **stricter** safety and
provenance rule and stop for founder direction.

## 1. Current provenance (aggregate-only)

Source of these aggregates: `docs/P0_4D_AI_ADJUDICATION_CURSOR_WORKSHEET.md`
(merged via PR #57 onto `cursor/p0-4b-label-dataset-observed-909d`).

| Field | Value |
|---|---|
| AI A/B independent evaluation sample | 200 |
| A/B agreements | 154 |
| A/B disagreements | 46 |
| Raw agreement | 77.0% |
| Cohen's kappa | 0.58037 |
| Third-AI adjudication queue | PASS 18 / REVIEW 2 / REJECT 26 |
| Combined 200-row offline final view | PASS 65 / REVIEW 9 / REJECT 126 |
| Adjudicated workbook SHA-256 | `4286855406f887f83c71392b4ab5ec8412b136b3275b209a643796da9180c377` |
| Question/answer text or XLSX in Git | **No** — operator-local only |
| Human ground truth | **Not established / absent** |
| Human labeling exercise | Skipped by founder operating decision (2026-07-28); volume-based operating decision only |
| Third-AI final labels | **Not** human ground truth |

Do **not** describe AI adjudication as a substitute for human ground truth.
Do **not** copy question text, answer text, reviewer notes, phone numbers,
emails, or row-level material into commits, PRs, issues, logs, or agent output.

## 2. Status boundary

| Item | Current status (this worksheet) |
|---|---|
| AI offline adjudication | `RECORDED` |
| Human ground truth | `ABSENT` |
| `HUMAN_LABEL_GATE` | `BLOCKED` |
| Local AI execution | `NOT_RUN` |
| Calibration | `NOT_READY` |
| Alpha readiness | `NOT_AUTHORIZED` |
| Production / DB / Vercel | `UNTOUCHED` |

### Naming map to existing repository documents

These worksheet labels do **not** rewrite other docs. Equivalent phrasing already
in-repo:

| This worksheet | Existing document phrasing |
|---|---|
| Human ground truth `ABSENT` | P0.4D: `NOT ESTABLISHED`; Local AI label gate: no human ground truth |
| Local AI execution `NOT_RUN` | `docs/LOCAL_AI_POC_STATUS.md`: `INACTIVE / NOT DEPLOYABLE` |
| Calibration `NOT_READY` | `CALIBRATION_READINESS` = `NOT_READY` |
| Alpha readiness `NOT_AUTHORIZED` | `docs/ALPHA_READINESS_CHECKLIST.md`: `BLOCKED_EXTERNAL` |
| AI offline adjudication `RECORDED` | P0.4D: AI A/B + third-AI adjudication `COMPLETE` as offline provenance only |

## 3. Non-implication rules (hard)

AI adjudication completion **does not** mean any of the following:

1. Human ground truth has been obtained.
2. Local AI execution is authorized.
3. Calibration readiness is achieved.
4. Alpha readiness is achieved or authorized.
5. A high A/B agreement rate is an independent ground-truth set — it is at most
   a **reference / continuity** offline proxy, not a scientific or launch gate.

Without a **separate, explicit founder authorization**, Local AI execution,
calibration, `HUMAN_LABEL_GATE`, `CALIBRATION_READINESS`, and alpha readiness
remain deferred / blocked as recorded in the existing gate documents.

## 4. Preconditions for a future Local AI run (do not execute here)

Document only. This section does **not** satisfy or start any of these items.

Before any future Local AI execution (separate founder-approved task), record:

1. Explicit founder authorization for that exact scope.
2. Approved work branch and verified base SHA.
3. Dataset snapshot identity and SHA-256 (operator-local; not committed).
4. Model name, version, and model-file hash.
5. Runtime and hardware information.
6. Prompt / template version.
7. Execution timestamp and seed.
8. Input and output artifact provenance (aggregate-safe).
9. Calibration evaluation definition (if calibration is in scope).
10. Failure rollback and stop conditions.
11. Execution procedure that never prints secrets.
12. Environment isolated from Production and application DB.

## 5. Required startup sequence for the next Cursor session

1. Read `AGENTS.md`.
2. Read `docs/P0_4D_AI_ADJUDICATION_CURSOR_WORKSHEET.md`.
3. Read this file: `docs/P0_4E_LOCAL_AI_PROVENANCE_AND_GATE_BOUNDARY.md`.
4. Verify current branch, base, and HEAD SHA against the authorized task.
5. Confirm gate statuses above (and in the Local AI / alpha documents).
6. Confirm founder authorization and scope for the requested work.
7. If the request exceeds authorization → report `BLOCKED` and stop.
8. Before any Local AI execution (only if separately authorized): record
   pre-run baseline and artifact hashes first; keep Production / DB / Vercel
   untouched unless that authorization explicitly includes them.

## 6. Explicitly prohibited inferences from P0.4D / P0.4E

Do not infer authorization for:

- downloading TEI, BGE-M3, Qwen, Ollama, or other model assets;
- starting Docker / Local AI sidecars;
- generating embeddings or sending raw text to remote services;
- changing thresholds, weights, SDS, Fast-track, or unlock behavior;
- wiring Depth Score into Next.js, Preview, or Production;
- applying migrations or changing live database data;
- declaring `HUMAN_LABEL_GATE`, `CALIBRATION_READINESS`, or alpha readiness
  passed;
- committing XLSX or row-level question/answer text.

Default next work remains **repository-only** documentation and provenance
maintenance.

## 7. Relationship to other gates

This worksheet supplements, and does not replace:

- `docs/P0_4D_AI_ADJUDICATION_CURSOR_WORKSHEET.md`
- `docs/LOCAL_AI_LABEL_DATASET_GATE.md`
- `docs/LOCAL_AI_POC_STATUS.md`
- `docs/ALPHA_READINESS_CHECKLIST.md`
- `AGENTS.md`

P0.4B human-label and calibration requirements remain unmet.
P0.4D AI adjudication remains offline provenance only.
P0.4E only hardens the boundary so later sessions do not confuse the two.
