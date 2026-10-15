# Stage 1 founder brand decisions — 2026-10-15

These explicit founder decisions supersede the human-test and social-handle
prerequisites in the August domain audit and the October 15 handoff. They apply
only to the 50-seat Closed Alpha Stage 1; trademark review is managed separately.

- At approximately 07:07Z the founder explicitly waived the five-human
  pronunciation/spelling pilot. No participants or results exist for that pilot.
- At approximately 07:08Z the founder stated that existing social accounts are
  numerous, retained their review personally, and waived the agent's social
  account checks as an alpha prerequisite. Account ownership and exact handles
  have not been independently verified by this execution.
- The founder directed the agent to focus on technical issues and trademark
  checks. Neither decision is trademark clearance or a waiver of technical,
  privacy, authentication, database-safety, or incident-response requirements.

At 07:16Z the founder stated that trademark review is already being handled
separately and directed this execution to focus on the remaining work. Record
`TRADEMARK_REVIEW=IN_PROGRESS_EXTERNALLY`; do not repeat that investigation or
ask for it again in the technical workstream. This is not a supplied clearance
result. The formal public-recruitment certificate still awaits that result.

## Machine-readable representation

The operational attestation may use `WAIVED_BY_FOUNDER` for
`evidence.domain.pronunciationSpellingReview` and
`evidence.domain.socialHandleReview`. Include `founderWaiver` with:

```json
{
  "policyVersion": "closed-alpha-brand-waivers-v1",
  "scope": "closed_alpha_stage_1",
  "approvedBy": "founder-seonghyeonist",
  "approvedAt": "2026-10-15T07:08:00Z",
  "decisionReference": "docs/FOUNDER_BRAND_DECISIONS_20261015.md",
  "pronunciationSpelling": true,
  "socialHandles": true
}
```

`approvedAt` is a conservative recorded decision time, not an exact chat-server
event timestamp. Preserve it during later operational reviews. The enclosing
operational review still expires after seven days. Exemptions are recorded in
the operational evidence digest; a waiver never becomes a successful test.
Leave `socialHandleEvidenceReference` empty when there is no actual evidence.
Continue to require `trademarkReview=NO_BLOCKING_CONFLICT_FOUND` only after a
substantive review. Never infer that value from these decisions.

This is an offline operational-gate policy change. It adds no application routes,
collects no member data and requires no database migration or production secret
change. Existing v4 attestations with genuine PASS/evidence remain supported.
