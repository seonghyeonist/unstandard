# Local AI Technical PoC Runbook — BGE-M3 embedding-first

## Status boundary

The original sections below preserve the **isolated v0.1 technical PoC** path.
The separately authorized v0.2 offline calibration is now complete and is
recorded below; it did not change app scoring or connect to Preview/Production.

The v0.1 path does **not**:

- activate app production scoring (live unlock remains `mock-local-heuristic-v0.0`);
- authorize a user-facing scoring change or Alpha readiness;
- install or run Qwen (`QWEN_STATUS = INACTIVE_NOT_INSTALLED`);
- connect to Preview/Production databases or Vercel.

The historical v0.1 reports retain their original human-label gate status. The
v0.2 run records `WAIVED_BY_FOUNDER / NOT_PERFORMED`.

## v0.2 offline calibration result

The full benchmark was run with the approved local workbook and real
`BAAI/bge-m3` model, pinned at revision
`5617a9f61b028005a4858fdac845db406aefb181`. It scored all 260 normalized pairs
from 1,000 physical rows after the pinned workbook SHA-256 matched. The model
returned 1,024 dimensions, zero NaN/Inf values, and max absolute determinism
difference `0.0`; final P50/P95 unique-pair latency was `183.655 / 259.699 ms`.

The accepted offline candidate is `V0_2_SYNTHETIC_PRIOR_CANDIDATE` with
`AI_STYLED` REVIEW 30/30, `SPAM_ABUSE` REJECT 19/20, and `ONBOARDING` bypass
PASS 10/10. Its overall and non-onboarding values are
`agreement_with_synthetic_prior` 139/260 and 129/250. These are comparisons
against the synthetic design prior and an offline label-disagreement proxy.
See `docs/LOCAL_AI_V0_2_SHADOW_PLAN_20260924.md` and the sanitized aggregates
under `docs/evidence/` for the complete threshold/category distributions.

Reproduce the v0.2 run using the existing isolated Python environment and full
workbook (do not supply `--max-pairs`):

```bash
export UNSTANDARD_LABELING_WORKBOOK_PATH=/absolute/private/path/Unstandard_LabelingDataset_v0.1.xlsx
npm run poc:local-ai:v0.2-calibrate
```

The app remains on `mock-local-heuristic-v0.0`; Qwen remains inactive. This
offline candidate alone does not establish Closed Alpha readiness.

## Approved input snapshot

| Field | Value |
|---|---|
| Snapshot ID | `ULDS-v0.1-b63f77dc-20260804` |
| Filename | `Unstandard_LabelingDataset_v0.1.xlsx` |
| Expected SHA-256 | `b63f77dc7fa10694e4af6d3fc5ee86c4fcb4b01bda0889a1e96bcba4b1a55e51` |
| Env path | `UNSTANDARD_LABELING_WORKBOOK_PATH` (absolute, operator-local) |
| Physical rows | 1,000 |
| Unique Q/A pairs | 260 (score distribution must use unique pairs) |

If the file is missing → harness exits `BLOCKED_INPUT_FILE_NOT_FOUND`.  
If the hash mismatches → harness exits `BLOCKED_INPUT_HASH_MISMATCH`.

## Canonical scoring thresholds (PoC contract)

| Name | Value |
|---|---|
| `min_answer_length` | 12 |
| `fast_track_min_length` | 8 |
| `fast_track_threshold` | 0.55 |
| `threshold` | 0.38 |
| `gray_band` | ±0.03 |

## Isolated filesystem layout

All model/cache/artifacts stay **outside the repo**:

```text
/tmp/unstandard-local-ai/
  models/
  cache/          # HF / sentence-transformers cache
  artifacts/
  reports/        # default redacted JSON output
  venv/           # dedicated Python venv
```

Override report directory with `UNSTANDARD_LOCAL_AI_POC_OUT` if needed.

## One-time setup

```bash
python3 -m venv /tmp/unstandard-local-ai/venv
/tmp/unstandard-local-ai/venv/bin/pip install --upgrade pip
/tmp/unstandard-local-ai/venv/bin/pip install -r scripts/local-ai/requirements-poc.txt
```

Do **not** install these packages into the Next.js app env or `services/depth-service`.

## Run

```bash
export UNSTANDARD_LABELING_WORKBOOK_PATH=/absolute/private/path/Unstandard_LabelingDataset_v0.1.xlsx
test -f "$UNSTANDARD_LABELING_WORKBOOK_PATH" || { echo "BLOCKED_INPUT_FILE_NOT_FOUND"; exit 2; }
sha256sum "$UNSTANDARD_LABELING_WORKBOOK_PATH"
# must equal b63f77dc7fa10694e4af6d3fc5ee86c4fcb4b01bda0889a1e96bcba4b1a55e51

# optional: npm script wrapper
npm run poc:local-ai:bge-m3

# or direct:
/tmp/unstandard-local-ai/venv/bin/python scripts/local-ai/poc_bge_m3.py \
  --smoke-physical-latency
```

Useful flags:

| Flag | Purpose |
|---|---|
| `--preflight-only` | OS/CPU/RAM/disk/runtime probe; no model, no workbook parse |
| `--smoke-physical-latency` | Latency smoke on a small physical-row sample (scores still unique-only) |
| `--max-pairs N` | Debug cap on unique pairs (omit for full technical run) |
| `--out DIR` | Redacted report directory |

## What the harness measures

Aggregate-only:

- preflight (OS/arch/CPU/GPU presence/RAM/disk/Python/runtime);
- workbook hash + physical vs unique pair counts;
- BGE-M3 load metadata (backend, revision/path if resolvable);
- embed success/fail counts, dimension, NaN/Inf;
- determinism on a fixed synthetic probe (cold/warm latency);
- unique-pair latency P50/P95, peak RSS, throughput;
- category score distribution + threshold-band counts;
- `agreement_with_synthetic_prior` only; compare solely with the synthetic design prior.

## Redacted reporting rules

**Allowed in stdout / JSON / PR / chat:** counts, rates, distributions, hashes, model ids/revisions, latency/memory aggregates, verdict codes.

**Forbidden everywhere (Git, logs, PR, chat, agent transcript):**

- raw question/answer text or whole rows;
- embeddings or vector dumps;
- model weight files;
- secrets / tokens / connection strings;
- descriptions that present workbook comparisons as human-reviewed findings;
- a Closed Alpha readiness claim based on this PoC.

Use `docs/evidence/LOCAL_AI_TECHNICAL_POC_HANDOFF_TEMPLATE.md` when filing aggregate results.

## Verdict codes

| Code | Meaning |
|---|---|
| `TECHNICAL_POC_PASS` | Embed + score path healthy; no hard issues |
| `TECHNICAL_POC_CONDITIONAL` | Runnable with soft issues (e.g. P95, unexpected counts) |
| `TECHNICAL_POC_FAIL` | Hard technical failure after inputs verified |
| `BLOCKED_RUNTIME` | Missing Python embedding stack / unusable workbook schema |
| `BLOCKED_MODEL_DOWNLOAD` | HF/model fetch failed |
| `BLOCKED_RESOURCE_LIMIT` | Insufficient disk/RAM for a safe local run |
| `BLOCKED_INPUT_FILE_NOT_FOUND` | Workbook path missing |
| `BLOCKED_INPUT_HASH_MISMATCH` | Workbook is not the approved snapshot |

## Offline helper tests (no model download)

```bash
cd scripts/local-ai
python3 -m unittest test_helpers.py -v
```

## Explicit non-claims

- Passing this PoC ≠ Alpha readiness.
- Passing this PoC ≠ calibration complete.
- `agreement_with_synthetic_prior` is an offline label-disagreement proxy only.
- App unlock scoring remains the deterministic mock until a separate, authorized wiring decision.
