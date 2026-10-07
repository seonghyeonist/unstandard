# Preview Sandbox identity erasure maintenance

Before maintenance, prove the exact Git-source Preview and its non-default RC
database binding. Preserve accepted members until deployed acceptance finishes.

The existing operator sign-in endpoint creates the normal 30-minute, HttpOnly
operator session. With that session, send a same-origin POST to
`/api/alpha/operator/identity-purges`. Send no provider references or user IDs.
The endpoint selects at most two due entries from the durable deletion outbox
and invokes the existing provider reconciler. Its private/no-store response
contains only selected, purged and retryable counts.

This path is available only with VERCEL_ENV=preview, DATABASE_ENV=test,
UNSTANDARD_RUNTIME_MODE=database and DIDIT_EXPECTED_ENVIRONMENT=sandbox.
Other environments receive 404. Missing operator session or invalid origin
receives 403. This endpoint does not create sessions or change verified member
bindings. Provider deletion acknowledgement is required before removing a queue
entry; failures remain queued with the existing retry backoff.

Read back the queue count and retained member eligibility after maintenance.
Classify expected negative tests separately from unexpected runtime failures.
Do not print secrets, cookies, provider references or raw identity data.

This is a bounded manual retry path, not a periodic scheduler. The existing
`identity:reconcile` CLI and authenticated member completion path also remain.
Next.js after() provides one post-response completion attempt; process termination
does not guarantee retry. Do not claim cron or Production erasure acceptance
from this Preview-only endpoint.
