# Git-linked Preview trigger — 2026-08-04

Purpose: create a real GitHub push event for the integrated P0 branch so Vercel can produce a non-production Preview deployment carrying authoritative `githubCommitSha` metadata.

Scope and guardrails:

- Branch: `agent/p0-integrated-execution-20260804`
- Canonical Vercel project: `unstandard-m9qj`
- Preview only; Production and Production DB remain untouched.
- This file is documentation-only and does not change application source or runtime behavior.
- A READY deployment is not sufficient by itself; the deployment metadata must match the commit SHA created by this marker commit.
- Disposable integration and authenticated A/B smoke remain separate gates.
