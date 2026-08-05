/** Shared constants for versioned proof artifacts (Artifact Version 1). */

export const ARTIFACT_VERSION = 1 as const;

/** Maximum age of a proof artifact accepted as readiness evidence (24h). */
export const PROOF_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Allowed clock skew for timestamps slightly in the future. */
export const PROOF_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const CANONICAL_PRODUCTION_HOSTNAME = "unstandard-m9qj.vercel.app";

export const CANONICAL_MAIN_BRANCH_ALIAS_HOSTNAME =
  "unstandard-m9qj-git-main-unstandard.vercel.app";

export const INTEGRATION_MATRIX = "real_postgresql_integration" as const;
export const SMOKE_MATRIX = "deployed_http_alpha_surface" as const;

export const REQUIRED_INTEGRATION_CASES = [
  "report_user_fk",
  "invite_consumed_by_user_fk",
  "lowercase_report_target_type",
  "duplicate_report_idempotency",
  "no_duplicate_report_row",
  "block_uniqueness",
  "unlock_uniqueness",
  "invite_concurrency",
  "invite_finalization_success",
  "invite_finalization_rollback",
  "migration_second_run_noop",
  "seed_idempotency",
  "db_unlock_reject_no_row",
  "db_unlock_pass_and_idempotent",
  "db_unlock_viewer_isolation",
  "db_private_profile_gate",
  "db_unlock_self_denied",
  "db_unlock_invalid_uuid",
] as const;

export type RequiredIntegrationCase = (typeof REQUIRED_INTEGRATION_CASES)[number];

export const REQUIRED_HTTP_SMOKE_CASES = [
  "anonymous_denied",
  "user_a_login",
  "user_b_login",
  "user_a_session",
  "user_b_session",
  "user_a_owns_session",
  "user_b_owns_session",
  "forged_reporter_id_rejected",
  "self_report_rejected",
  "duplicate_open_report_is_idempotent",
  "session_response_redacted",
  "session_response_no_store",
  "logout_invalidates_session",
  "cleared_cookie_denied",
  "revoked_session_rejected",
  "a_to_b_private_before_unlock_forbidden",
  "a_to_b_unlock_pass",
  "a_to_b_unlock_status_true",
  "a_to_b_private_after_unlock_ok",
  "b_to_a_private_isolated",
  "duplicate_unlock_idempotent",
  "private_response_no_store",
] as const;

export type RequiredHttpSmokeCase = (typeof REQUIRED_HTTP_SMOKE_CASES)[number];

/** Retained for historical artifact fixtures only — no longer future/not-applicable. */
export const FUTURE_NOT_APPLICABLE_PRIVATE_PROFILE = {
  name: "legacy_mock_private_profile_note",
  reason:
    "Historical placeholder only. DB-backed private-profile denial is now a required smoke case.",
} as const;
