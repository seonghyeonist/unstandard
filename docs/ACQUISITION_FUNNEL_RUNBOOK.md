# Alpha acquisition funnel — 2026-11-03

## Scope and migration plan

Release from verified Production SHA `4cf4338c95a390b956cddd3ca1817fe8fb5327d9`, not from unmerged dependency/alpha PRs. No auth, KYC, invitation or member schema changes. Apply additive migration `0016_acquisition_daily` after checking ledger 0000–0015 and exact target. It creates one aggregate-only table. No existing rows are backfilled, changed or removed. Builds never migrate. First rehearse on an empty isolated database. Production migration and release require founder execution approval under this task's scope.

Rollback: reassign Production to READY deployment `dpl_8yLrAn6sy2WccABGQxhZDCF12frU` (SHA above). Leave the additive aggregate table intact; do not drop it during rollback. Recheck alias and `/api/waitlist` read-only. Production synthetic submissions are not authorized.

## Measurement contract

Browser events: `landing_view` (hydrated page load), `alpha_cta_click` (each click), `waitlist_form_view` (at least 50% visible, once per page mount), `waitlist_submit_attempt` (native validation passed), `waitlist_submit_error` (browser-observed non-2xx or network failure). Strict-mode effect replays do not duplicate page/view events. Repeated page loads count again.

Server-only events: `waitlist_submit_accepted` and `waitlist_created` increment in the same DB transaction as the insert/duplicate decision. Public analytics POST rejects these event names. Accepted includes duplicate email submissions. Created only increments for a new row. A rollback increments neither. Counters are cumulative events, unlike net surviving waitlist rows. Deleting a waitlist entry removes its visit rows by cascade; anonymous aggregate counts have no link to the entry and remain.

Public endpoint `/api/acquisition` only writes bounded counters. No public GET/dashboard exposes aggregate creation counts. Operators query Neon using their existing restricted access. No new operator credential or endpoint is introduced.

UTM attribution is client-declared, not verified. Allowed sources: `instagram`, `everytime`; media: `paid_social`, `organic_social`, `social`; campaign: `alpha_recruitment`; content: `reel_a`, `reel_b`, `post_a`, `post_b`. Max 40 chars per field. Other nonempty values become `unknown`; missing values become `none`. Arbitrary strings, raw URL, referrer, email, ad click IDs and profile data are not stored. No tracking cookies, local/session storage, session IDs, Meta Pixel/CAPI or third-party analytics. Existing waitlist deletion/receipt cookie and existing short-lived hashed security rate limits remain separate from analytics.

Labels: `instagram_paid`, `instagram_organic`, `everytime`, `direct_or_unattributed`, `other_unknown`. The no-UTM group does not prove direct traffic: old Instagram ads also fall here. Existing trusted `waitlist_entries.acquisition_channel` remains unchanged for compatibility with alpha policy; do not use its `organic` value as the new marketing source. Use `acquisition_daily` for declared source conversion counts.

New and duplicate POSTs receive the same 202 body and same-shaped opaque signed receipt cookie. GET `joined` means an accepted browser receipt OR an existing legacy deletion capability, not proof of a newly created row. Duplicate receipts cannot delete another browser's entry. Same-email resubmissions preserve an existing authorized deletion capability. Legacy capabilities remain supported. Timing is not claimed constant.

## Operator dashboard

```sql
SELECT day, channel, campaign, content,
 sum(count) FILTER (WHERE event='landing_view') landing_views,
 sum(count) FILTER (WHERE event='alpha_cta_click') cta_clicks,
 sum(count) FILTER (WHERE event='waitlist_form_view') form_views,
 sum(count) FILTER (WHERE event='waitlist_submit_attempt') attempts,
 sum(count) FILTER (WHERE event='waitlist_submit_accepted') accepted,
 sum(count) FILTER (WHERE event='waitlist_created') created,
 sum(count) FILTER (WHERE event='waitlist_submit_error') errors
FROM acquisition_daily
WHERE day BETWEEN :start_kst_date AND :end_kst_date
GROUP BY day, channel, campaign, content ORDER BY day,channel,campaign,content;
```

Missing rows before measurement starts mean NOT_MEASURED, not zero. For a known healthy collection window, an absent event bucket can be zero-filled. Ratios use the SAME KST window/channel/campaign/content: CTA/landing, attempts/CTA, accepted/attempts, created/landing. Report every numerator/denominator. These are event-count proxies, not unique-person conversion rates or individually linked journeys. A visible form can be submitted without clicking the CTA; attempts/CTA can exceed 100%. Browser drops, blockers, automation, reloads, rate limits (120 analytics events/IP/hour), and different accepted/attempt transport reliability can distort ratios. No session linkage or deterministic attribution across visits. Network/server failures may prevent client error delivery. Do not silently interpret missing client events as no users.

New-registration channel share: `created(channel)/created(all)`. Unattributed share: `(direct_or_unattributed + other_unknown) landing_views / all landing_views`. Report sample count and uncertainty. No historical CTA/view reconstruction and no claim that 4/100 is an ad conversion rate.

## Next controlled advertisement

Paid: `https://unstandard.app/?utm_source=instagram&utm_medium=paid_social&utm_campaign=alpha_recruitment&utm_content=reel_a`
Organic: `https://unstandard.app/?utm_source=instagram&utm_medium=organic_social&utm_campaign=alpha_recruitment&utm_content=post_a`
Everytime: `https://unstandard.app/?utm_source=everytime&utm_medium=social&utm_campaign=alpha_recruitment&utm_content=post_b`

Confirm campaign name in Ads Manager before applying these labels. No Meta account changes were performed by this work. Export Link clicks, Outbound clicks, Landing page views, spend and date/timezone from Meta. Keep those separately sourced from first-party page-load events. Reuse the current creative for the first controlled experiment to avoid changing creative and landing simultaneously. Begin with a bounded test, compare source groups, calculate spend/server-confirmed paid-channel created events; do not expand budget solely because clicks increase. The 12% created/landing hypothesis is a product target, not an industry benchmark, guarantee, or a statistically proven improvement. Review only after sufficient observed page loads; small samples require wide uncertainty. Full 50-person alpha capacity does not imply remaining 45 seats or invite approval.

Security review: event and dimension allowlists prevent PII/high-cardinality storage; server-only conversions cannot be forged through the public event endpoint; same-origin checks, payload bounds and a separate rate-limit policy apply; no email/log/DB credentials in browser analytics. Browser events remain spoofable and are labelled accordingly. No authentication policy changes or formal-alpha gate verdict changes.
