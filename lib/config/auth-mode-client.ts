/**
 * Client-side auth hints — never reads secrets or DATABASE_URL.
 */

export function isDatabaseAuthExpected(): boolean {
  return process.env.NEXT_PUBLIC_RUNTIME_MODE === "database";
}
