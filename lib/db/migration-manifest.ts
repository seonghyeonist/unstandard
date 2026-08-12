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
  {
    file: "0002_flippant_lady_vermin.sql",
    hash: "d580b386b12e8c05e8ceacb474e7ee418222500da30805ecbd6e01cc7790fbf2",
  },
  {
    file: "0003_striped_jane_foster.sql",
    hash: "f65c7895fb277e3a68d4792e163ed83208b705a0f33f1d336c5b41715c08cfd0",
  },
  {
    file: "0004_vengeful_marvex.sql",
    hash: "da78c7b40704470b9fe02078141ea5c8944d4bb277eae3042635f326b968978c",
  },
  {
    file: "0005_alpha_stage1_measurement.sql",
    hash: "0f0575bae676144d2b70b27f74e3f04b8c8d0faa4a708dc93e6494670183f608",
  },
  {
    file: "0006_alpha_funnel_waitlist.sql",
    hash: "d2d1054723b2674651206d89939c952162c02ed2e00b636fddbed8a73320667a",
  },
] as const;

export const EXPECTED_MIGRATION_HASHES = EXPECTED_MIGRATION_LEDGER.map(
  (migration) => migration.hash,
);
