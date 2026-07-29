# P0.4G — Local AI Execution Readiness Closure

## Verdict

`BLOCKED_EXTERNAL` — this document closes the repository-side readiness audit but does not authorize Local AI execution, calibration, HUMAN_LABEL_GATE transition, alpha readiness, or application/infrastructure changes.

## Scope and provenance

- Founder authorization context: `P0.4G-2026-07-29-LOCAL-AI-OFFLINE-PILOT`.
- This commit narrows the scope to readiness closure and evidence recording.
- No model was downloaded or executed.
- No raw question/answer text is included.
- AI adjudication remains provenance only and is not human ground truth.

## Repository baseline

| Field | Observed value |
|---|---|
| Repository | `seonghyeonist/unstandard` |
| Base branch | `cursor/p0-4b-label-dataset-observed-909d` |
| Base SHA | `e9e3f997249ccda45319625e8488fef52fc78c04` |
| Prerequisite | PR #60 merged at the base SHA |
| Current branch | `cursor/p0-4g-readiness-closure-909d` |
| Scope of this commit | this document only |

## Dataset evidence

The founder-provided workbook is present in the operator-local attachment area. It is not copied into Git.

| Field | Observed value |
|---|---|
| Filename | `Unstandard_LabelingDataset_v0.1.xlsx` |
| SHA-256 | `b63f77dc7fa10694e4af6d3fc5ee86c4fcb4b01bda0889a1e96bcba4b1a55e51` |
| Workbook sheets | 5, all visible |
| Labeling sheet dimensions | `A1:O1002` |
| Physical labeling rows | 1,000 |
| Snapshot ID | `ABSENT` — no separately approved executable snapshot identity was supplied |
| Dataset role | offline label source; structural/provenance evidence only |
| Raw text handling | not copied to Git, PR, logs, or this document |

### Observed category distribution

| Category | Rows |
|---|---:|
| `L1_PASS` | 100 |
| `L2_PASS` | 100 |
| `L3_PASS` | 150 |
| `L4_PASS` | 150 |
| `L5_PASS` | 150 |
| `GRAY_BAND` | 100 |
| `SPAM_ABUSE` | 100 |
| `AI_STYLED` | 50 |
| `ONBOARDING` | 100 |
| **Total** | **1,000** |

The workbook's observed category plan is not identical to the v4.2 PoC's recommended sample groups. In particular, the workbook separates GRAY_BAND and ONBOARDING, while the PoC groups L3 and L4/L5 and uses a different abuse/reject grouping. Therefore:

`DATASET_SPEC_ALIGNMENT: REQUIRES_RECONCILIATION`

### Human-label boundary

- The workbook's recommended labels and paths are a synthetic design prior.
- They are not independent human labels.
- The workbook contains no established human ground truth.
- The 1,000 physical rows contain duplicated question/answer pairs; they must not be treated as 1,000 independent observations.
- The required blind double-labeling gate remains unmet.

`HUMAN_LABEL_GATE: BLOCKED`

## Spec and application naming reconciliation

The apparent naming discrepancy is real but more specific than the prior preflight summary indicated: v4.2 contains two related configuration vocabularies.

| Source | Relevant configuration |
|---|---|
| v4.2 Part I / product app_config table | `fast_track_min_length = 12`; `fast_track_fast_length = 8` |
| Workbook app_config sheet | `fast_track_min_length = 12`; `fast_track_fast_length = 8` |
| v4.2 Part III / Local AI PoC | `min_answer_length = 12`; `fast_track_min_length = 8`; `fast_track_threshold = 0.55` |
| Current depth-service RuntimeConfig | `min_answer_length = 12`; `fast_track_min_length = 8`; `fast_track_threshold = 0.55` |
| Current TypeScript mock | minimum length `12`; Fast-track minimum length `8`; Fast-track score `0.55` |

The workbook is therefore aligned with the Part I/product table but not with the Part III Local AI/runtime contract. No code or workbook value is changed in this closure commit.

`APP_CONFIG_NAMING_ALIGNMENT: REQUIRES_FOUNDER_CONFIRMATION`

Recommended future canonical mapping for the Local AI contract, subject to founder confirmation:

- `min_answer_length = 12` for the basic path.
- `fast_track_min_length = 8` for the Fast-track path.
- `fast_track_threshold = 0.55` as the Local AI contract name.
- Treat `fast_track_fast_length` as a legacy workbook/product alias only if an explicit translation rule is approved.

## Local AI runtime and harness preflight

| Item | Status |
|---|---|
| Ollama | absent |
| Docker | absent |
| llama.cpp CLI/server | absent |
| TEI executable | absent |
| Transformer/embedding runtime | absent |
| Installed model file | absent |
| Approved isolated pilot harness | absent |
| Existing depth-service | inactive scaffolding; requires a TEI endpoint and service configuration |
| TypeScript depth evaluator | deterministic mock heuristic; explicitly not Local AI |

No package install, model download, Docker image pull, network model fetch, or model execution was performed.

`LOCAL_AI_RUNTIME: ABSENT`

`MODEL: ABSENT`

`APPROVED_HARNESS: ABSENT`

`NETWORK_ISOLATION: NOT_ESTABLISHED`

## Design constraints carried forward

- Embedding-first remains the intended architecture: BGE-M3 candidate, feature scoring, and rule penalties.
- Qwen remains optional review/coaching assistance, not the primary judge.
- PASS / REVIEW / REJECT and the gray-band human review queue remain in force.
- Reference targets remain threshold `0.38`, Fast-track `0.55`, gray band `±0.03`, and P95 latency `≤ 1,200 ms`; these are PoC targets, not calibration results.
- Raw answer retention is minimized; embeddings are treated as derived personal data.
- The AI Agent Harness playbook's generic Supabase examples do not override the repository's current Neon/Drizzle/Better Auth architecture.
- The alpha/beta direction remains university students as an alpha recruitment wedge and ages 25–39 as the beta/main target, with qualitative-first and quantitative-later reveal.

## Gate status after this closure

| Gate | Status |
|---|---|
| Local AI execution | `NOT_RUN` |
| Calibration | `NOT_RUN` |
| Human ground truth | `ABSENT / NOT ESTABLISHED` |
| HUMAN_LABEL_GATE | `BLOCKED` |
| Alpha readiness | `NOT_AUTHORIZED` |
| Production | `UNTOUCHED` |
| Database | `UNTOUCHED` |
| Vercel | `UNTOUCHED` |
| Secrets | not exposed |

## Remaining external prerequisites

1. Founder explicitly approves a separate executable dataset snapshot identity and its use as a Local AI input. The current workbook hash alone is not that approval.
2. Founder confirms the canonical translation between the Part I/workbook names and the Part III/runtime names.
3. A second independent human reviewer completes the blind-label protocol for at least 200 deduplicated unique pairs before calibration claims are considered.
4. An already-installed offline runtime and model are supplied, with model name/version and file SHA-256.
5. An approved harness is supplied or separately authorized, with raw-text redaction and Production/DB isolation demonstrable.
6. A separate founder authorization is issued for pilot execution; a successful pilot still does not promote calibration or alpha readiness.

## Final status

`RESULT: BLOCKED_EXTERNAL`

`execution: NOT_RUN`

`calibration_executed: no`

`alpha_readiness: NOT_AUTHORIZED`

Completion of this document closes the repository-side audit and corrects the earlier oversimplified app_config finding. It does not claim that the Local AI PoC ran or that any launch gate passed.
