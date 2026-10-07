/** Manual Sandbox maintenance is never enabled for a Production database. */
export function canOperateSandboxPurges(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV === "preview" && env.DATABASE_ENV === "test" &&
    env.UNSTANDARD_RUNTIME_MODE === "database" && env.DIDIT_EXPECTED_ENVIRONMENT === "sandbox";
}
