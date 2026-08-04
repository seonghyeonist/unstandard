# Handoff — P0 Integrated Execution (2026-08-04 KST)

## RESULT

`CONDITIONAL` / `BLOCKED_EXTERNAL` for remaining exact-SHA Preview + A/B gates.

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
| Workbook in environment | **PRESENT**; hash verified via `UNSTANDARD_LABELING_WORKBOOK_PATH` |
| Runtime | Python 3.12 + `sentence-transformers==3.4.1` + `torch==2.5.1+cu124` (CUDA unavailable; CPU execution) in `/tmp/unstandard-local-ai/venv` |
| Model | `BAAI/bge-m3`; revision `5617a9f61b028005a4858fdac845db406aefb181`; config SHA-256 `26159e7ad065073448460117eb24b7a4572f6f4e78eadff65dc0a11c052449fa` |
| Device | CPU |
| Embedding dimension | 1024 |
| Dataset structure | 1,000 physical rows; 260 unique pairs; ASCII-space answer-length invariant 1,000/1,000 |
| Dataset PoC latency | Unique-pair P50 ~158ms / P95 ~296ms; physical-row smoke P95 ~1,179ms (reference ≤1,200ms) |
| Dataset PoC verdict | `TECHNICAL_POC_PASS`; report `docs/evidence/bge_m3_technical_poc_20260804T071639Z.json` |
| Embedding health | 260/260 successful; 1024 dimensions; NaN/Inf 0; determinism max abs diff 0 |
| Synthetic-prior proxy | 171/260 = 65.7692%; not human accuracy or ground truth |
| Human-label caveat | founder deferred; not a pass |
| Qwen | `INACTIVE_NOT_INSTALLED` |

## Database

| Field | Value |
|---|---|
| Disposable integration | Neon project `unstandard-alpha-integration-disposable`, branch `integration-poc-20260804`, host `ep-wispy-queen-…us-east-1` |
| Preview app DB | Neon project `unstandard-alpha-preview-app-db`, branch `preview-ab-smoke-20260804`, host `ep-noisy-wave-…us-east-2` |
| Separation check | **PASS** (different project IDs + regions) |
| Integration | `npm run test:integration` **PASS** 12/12; artifact `docs/evidence/INTEGRATION_PROOF_20260804_5d2fece.json`; artifact records test SHA `5d2fece…`, so it is not exact-tip evidence for current integration head `0f4086a…` |
| Preview migrate/seed | complete on Preview branch |
| Preview aggregates | users=4, profiles=4, sessions=9, pending_invites=0 |

## Vercel Preview

| Field | Value |
|---|---|
| Canonical project | `unstandard-m9qj` (`prj_9RHqHMFTeB0c2V3LGlAdTezmvcYn`) |
| Preview build | **READY** — deployment `dpl_5YggAwzJ8K3YVEFJsdeDiYWuGi99`, URL `https://unstandard-m9qj-mz9w3gm0r-unstandard.vercel.app`; `npm ci` + Next.js build completed without errors |
| Exact-SHA deploy for integration head | **NOT PROVEN** — this was a successful manual file deployment; Vercel returned no `githubCommitSha` metadata, so READY is not treated as exact-SHA evidence |
| Earlier failed Preview attempt | `dpl_91bsco8Qzy7UuNG6cnnnTHG4sUMX` failed at `npm ci` because the upload omitted `package-lock.json`; fixed by the READY deployment above |
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
| Local AI technical PoC (full dataset) | **PASS** — technical only; not calibration |
| Local AI runtime/model | **PASS** — isolated CPU execution; Qwen inactive |
| Human-label gate | `NOT_RUN_FOUNDER_DEFERRED` |
| Overall Alpha readiness | `BLOCKED_INCOMPLETE_GATES` |
| Production | `UNTOUCHED` |

## USER ACTION REQUIRED

1. Provide or connect a Vercel Git-linked/CLI Preview deployment path so the published integration head `0f4086a…` is recorded as `githubCommitSha` on **`unstandard-m9qj` only** (non-production).
2. Inject Preview smoke secrets through the secret manager, never chat: A/B passwords, optional protection bypass, `ALPHA_INVITE_PEPPER` or `BETTER_AUTH_SECRET`, and confirm Preview `DATABASE_URL` targets `preview-ab-smoke-20260804`.
