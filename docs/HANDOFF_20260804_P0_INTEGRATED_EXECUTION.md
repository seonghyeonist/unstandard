# Handoff — P0 Integrated Execution (2026-08-04 KST)

## RESULT

`CONDITIONAL` / `BLOCKED_EXTERNAL` for remaining Preview A/B + dataset PoC gates.

## Explicit non-claims

- `HUMAN_LABEL_GATE: NOT_RUN_FOUNDER_DEFERRED`
- No human accuracy / final calibration / overall Alpha PASS claimed
- Production / Production DB / production domains: **UNTOUCHED**
- PR #63 / #64: still **OPEN** (not merged, not closed)

## GitHub

| Field | Value |
|---|---|
| Repository | `seonghyeonist/unstandard` |
| Integration branch | `agent/p0-integrated-execution-20260804` |
| Base | `cursor/p0-4g-readiness-closure-909d` (`568f84d…`) |
| Head | see latest commit on branch |
| Commits from PR #64 | `7de64b7` then `41b3f48` (cherry-picked) |
| Draft PR | https://github.com/seonghyeonist/unstandard/pull/65 |
| CI | Rebuild CI static-gates **SUCCESS** |
| #63 / #64 | remain Draft/Open |

## Local AI

| Field | Value |
|---|---|
| Dataset filename | `Unstandard_LabelingDataset_v0.1.xlsx` |
| Expected SHA-256 | `b63f77dc7fa10694e4af6d3fc5ee86c4fcb4b01bda0889a1e96bcba4b1a55e51` |
| Snapshot ID | `ULDS-v0.1-b63f77dc-20260804` |
| Workbook in environment | **ABSENT** → `BLOCKED_INPUT_FILE_NOT_FOUND` |
| Runtime | Python 3.12 + `sentence-transformers==3.4.1` + `torch==2.5.1+cpu` in `/tmp/unstandard-local-ai/venv` |
| Model | `BAAI/bge-m3` downloaded; snapshot digest in `docs/evidence/BGE_M3_MODEL_MANIFEST_20260804.json` |
| Device | CPU |
| Embedding dimension | 1024 |
| Synthetic warm P50 / P95 | ~132ms / ~239ms (ref target ≤1200ms; synthetic only) |
| Dataset PoC verdict | `BLOCKED_INPUT_FILE_NOT_FOUND` |
| Runtime smoke verdict | `RUNTIME_SMOKE_PASS_SYNTHETIC` (not a dataset PoC PASS) |
| Human-label caveat | founder deferred; not a pass |
| Qwen | `INACTIVE_NOT_INSTALLED` |

## Database

| Field | Value |
|---|---|
| Disposable integration | Neon project `unstandard-alpha-integration-disposable`, branch `integration-poc-20260804`, host `ep-wispy-queen-…us-east-1` |
| Preview app DB | Neon project `unstandard-alpha-preview-app-db`, branch `preview-ab-smoke-20260804`, host `ep-noisy-wave-…us-east-2` |
| Separation check | **PASS** (different project IDs + regions) |
| Integration | `npm run test:integration` **PASS** 12/12; artifact `docs/evidence/INTEGRATION_PROOF_20260804_eb73843.json` |
| Preview migrate/seed | complete on Preview branch |
| Preview aggregates | users=4, profiles=4, sessions=9, pending_invites=0 |

## Vercel Preview

| Field | Value |
|---|---|
| Canonical project | `unstandard-m9qj` (`prj_9RHqHMFTeB0c2V3LGlAdTezmvcYn`) |
| Exact-SHA deploy for integration head | **NOT CREATED** — Vercel CLI credentials ABSENT; Git auto-deploy not observed for this branch |
| Production touched | **no** |

## A/B Smoke

| Field | Value |
|---|---|
| Identities | A / B only |
| Invite/signup | blocked — `ALPHA_INVITE_PEPPER` / `BETTER_AUTH_SECRET` ABSENT in agent env; A/B passwords ABSENT |
| Profile IDs resolved | no (this run) |
| `npm run smoke:authorization` | **NOT RUN** |
| Blockers | Preview exact-SHA URL, protection bypass, A/B passwords, invite pepper |

## Readiness

| Layer | Verdict |
|---|---|
| Machine technical (unit/CI + disposable integration) | **PASS** |
| Local AI technical PoC (full dataset) | **BLOCKED_INPUT_FILE_NOT_FOUND** |
| Local AI runtime (synthetic) | conditional evidence only |
| Human-label gate | `NOT_RUN_FOUNDER_DEFERRED` |
| Overall Alpha readiness | `BLOCKED_INCOMPLETE_GATES` |
| Production | `UNTOUCHED` |

## USER ACTION REQUIRED

1. Attach or inject operator-local `Unstandard_LabelingDataset_v0.1.xlsx` (SHA-256 must match) via `UNSTANDARD_LABELING_WORKBOOK_PATH`.
2. Provide Vercel auth for CLI (`vercel login` device approval or `VERCEL_TOKEN`) so Preview can be deployed to **`unstandard-m9qj` only** at the integration head SHA (non-production).
3. Inject Preview smoke secrets (not via chat): A/B passwords, optional protection bypass, `ALPHA_INVITE_PEPPER` or `BETTER_AUTH_SECRET`, and confirm Preview `DATABASE_URL` targets `preview-ab-smoke-20260804`.
