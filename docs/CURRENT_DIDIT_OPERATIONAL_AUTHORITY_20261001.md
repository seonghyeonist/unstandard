# Current Didit Sandbox Operational Authority — 2026-10-01

This dated record supersedes the Didit retention and release-gate statements in
[the 2026-09-28 snapshot](./CURRENT_ALPHA_AUTHORITY_20260928.md) wherever they
conflict with the observations and decisions below. Historical files remain
unchanged in substance and retain their original evidence dates.

## Current provider-console observation

Observed 2026-10-01 in the Didit console:

| Environment | Mode | Session retention | Face template |
| --- | --- | --- | --- |
| `unstandard (Sandbox)` | Sandbox/test | 1 month | Deleted with session |
| `My Application` | Live | Unlimited | Deleted with session |

These are mutable provider-console settings, not permanent contractual
guarantees. The Sandbox value of 1 month supersedes the older 2-year Sandbox
observation in the 2026-09-28 authority snapshot. The Live environment exists,
but no Live session was created and no Live setting was changed.

The founder/operator confirmed in the console that the Free KYC Sandbox
workflow launches and completes with the Korean ID/document route and the
configured ID verification, passive liveness, face match, adult-age check,
and device/IP analysis stages. Sandbox outcomes are simulated provider
verdicts. This is evidence of workflow configuration and app-level integration
testing only; it is not a real-person identity determination or a claim of
production or legal effect.

## Current implementation decisions

- The executed DPA identifies Didit Identity Spain, S.L. as the contractual
  Didit entity and states that primary processing infrastructure is in the
  EEA. This is the established engineering disclosure basis; it is not a legal
  opinion or an account-specific support confirmation.
- The published Korean notice describes the hosted Didit flow, relevant
  identity-document, liveness, face-match, adult-age, and device/IP processing;
  the provider retention model; UNSTANDARD's minimal local result storage; and
  the provider-session deletion gate. It does not promise immediate physical
  deletion by Didit.
- Identity notice and biometric-consent versions are
  `alpha-identity-v2` and `alpha-biometric-identity-v2`.
  `IDENTITY_PROVIDER_NOTICE_READY=true` is in the same reviewed change as the
  notice. `UNSTANDARD_IDENTITY_ENABLED=false` remains the template default;
  missing or invalid server-only Preview configuration still fails closed.
- A user may decline the identity/age consent; the introduction feature that
  requires verification then remains unavailable. Account deletion and the
  profile information deletion / introduction-withdrawal path remove the
  local identity result and enqueue provider-session purge as implemented.
- The signed contractual evidence and the founder-confirmed Sandbox workflow
  are sufficient for the current Sandbox engineering task. Generic account,
  support, or region clarifications are non-blocking unless contradictory
  primary evidence appears.

## Release boundary

Do not create a Live verification session, change Live configuration, enable
Production collection, merge the release, enable Local AI, require human
review, or run password-reset acceptance without a later explicit founder
decision. Human review remains founder-waived / NOT_PERFORMED; Local AI remains
off and non-authoritative; password reset remains excluded.

