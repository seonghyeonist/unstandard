/**
 * Build-time migration identity used by the read-only Production readiness
 * check. Drizzle stores the SHA-256 of each SQL migration in its ledger.
 *
 * Keep this manifest reviewable. The unit test recomputes every file hash, so
 * changing migration SQL without updating this list fails CI.
 */
export const EXPECTED_MIGRATION_LEDGER = [
  {
    file: "0000_initial.sql",
    hash: "6bd0bb0c021a800c043b409f1d69311bb689a0578133d3fd60829f7220a2e39a",
  },
  {
    file: "0001_unlock_attempts.sql",
    hash: "4773cee53b87161c60eb4e83eb0ffd484972d3f8b001e1c71acf72bcb3fb2c1d",
  },
] as const;

export const EXPECTED_MIGRATION_HASHES = EXPECTED_MIGRATION_LEDGER.map(
  (migration) => migration.hash,
);
