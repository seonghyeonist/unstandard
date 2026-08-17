# Stage-1 supply role and consent procedure

**Contract:** `stage1-role-preference-v1`

**Founder approval:** 2026-08-17

**Comparable market:** consenting adults in the Seoul metro area seeking
one-to-one romantic conversation

This is a supply-balancing operations contract. It does not infer or collect
gender, sexuality, or identity, and it is not a matching-quality claim.

## Optional role question

Ask separately from account registration:

> For this closed alpha, which first-conversation role do you prefer?

- `bucket_a`: I prefer to initiate the first conversation.
- `bucket_b`: I prefer to receive a first conversation before responding.
- `not_counted`: both, neither, skip, unclear, no consent, or withdrawn.

Before recording A or B, state that the answer is optional and will be used
only to balance this Stage-1 market. Record affirmative consent to that use.
Do not copy free-text explanations into the product database.

## Data and enforcement

For A/B, the invite stores only the opaque bucket, consent contract version,
and UTC consent date. It does not store the question prose, precise time, or an
identity attribute. The operator CLI and PostgreSQL both reject A/B without
the exact version and date. `not_counted` must have null consent metadata.

```bash
npm run alpha:invite:create -- \
  --email person@example.com \
  --cohort founder_network \
  --channel founder_direct \
  --balance-bucket bucket_a \
  --balance-consent-version stage1-role-preference-v1 \
  --balance-consented-on 2026-08-17
```

If consent is absent or ambiguous, use `not_counted` and omit both consent
flags. Never fill the fields through direct SQL.

## Withdrawal and correction

- Before consumption: revoke or pause the invite and reissue as `not_counted`.
- After consumption: pause recruitment, exclude the row from the next supply
  decision, and have the privacy owner perform a reviewed correction.
- Never rewrite an A answer into B, or vice versa, without a fresh affirmative
  answer and consent under the current contract.
- A new question, market, or use requires a new version and founder review.

The content-free metrics query counts only A/B rows with the exact approved
version and a non-null consent date. Missing or insufficient consent remains
`INSUFFICIENT_DATA`; it cannot become a launch PASS through imputation.
