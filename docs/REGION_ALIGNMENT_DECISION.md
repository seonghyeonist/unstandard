# Region Alignment Decision

## Context

- Current Vercel Functions deployment region: **iad1** (US East)
- Closed alpha primary audience: **Korea**
- Database and application function region must be chosen together

## Option A — Keep Vercel in iad1, Neon near iad1

| Pros | Cons |
|------|------|
| No Vercel redeploy or routing change | Higher RTT for Korean users on auth/API paths |
| Fast app↔DB latency inside iad1 | Perceived latency on session/profile mutations |
| Lowest migration risk for current Preview | Misaligned with Korean alpha UX expectations |

**Neon target:** US East (e.g. `aws-us-east-1` / Neon project in Virginia-equivalent region)

## Option B — Move Vercel Functions to Asia, Neon in matching Asia region

| Pros | Cons |
|------|------|
| Better Korean user latency | Requires coordinated Vercel region change |
| App and DB remain co-located | One-time deployment/runbook churn |
| Aligns with closed-alpha operator geography | Must re-validate Preview smoke from Asia edge |

**Neon target:** Asia Pacific (e.g. `aws-ap-southeast-1` or Neon Seoul-equivalent when available)

## Recommendation for Korean closed alpha

**Choose Option B** for the closed alpha if operator acceptance testing is primarily from Korea and session-heavy flows (invite claim, sign-up, onboarding answer save) are P0 UX.

However, execute Option B only after:

1. Static rebuild gates pass on PR #55
2. Staging Neon bootstrap succeeds in the chosen Asia region
3. Preview redeploy confirms the Vercel function region and Neon region match

## Decision status

- **This task does not change Vercel region.**
- **Do not create Neon in a different region than the Vercel function region you intend to run.**
- Record the final paired choice in the staging bootstrap report before alpha invite issuance.
