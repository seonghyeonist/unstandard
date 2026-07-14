import { appendFileSync, mkdirSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ProofCase } from "@/lib/readiness/proof-artifact";
import { REQUIRED_INTEGRATION_CASES } from "@/lib/readiness/proof-constants";

/**
 * Integration case observation log.
 * Cases are recorded only after the corresponding assertion body completes successfully
 * (or fails). Presence of a test function alone is not enough.
 */
export function getIntegrationCaseLogPath(): string | null {
  const path = process.env.UNSTANDARD_INTEGRATION_CASE_LOG?.trim();
  return path || null;
}

export function recordIntegrationCase(name: string, status: "PASS" | "FAIL"): void {
  const path = getIntegrationCaseLogPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ name, status })}\n`, "utf8");
}

/**
 * Wrap an integration assertion so status is derived from observed execution.
 * On success records PASS; on throw records FAIL then rethrows.
 */
export async function observeIntegrationCase(
  name: (typeof REQUIRED_INTEGRATION_CASES)[number] | string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
    recordIntegrationCase(name, "PASS");
  } catch (error) {
    recordIntegrationCase(name, "FAIL");
    throw error;
  }
}

export function readObservedIntegrationCases(logPath: string): ProofCase[] {
  if (!existsSync(logPath)) return [];
  const lines = readFileSync(logPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const byName = new Map<string, "PASS" | "FAIL">();
  for (const line of lines) {
    const parsed = JSON.parse(line) as { name?: unknown; status?: unknown };
    if (typeof parsed.name !== "string" || (parsed.status !== "PASS" && parsed.status !== "FAIL")) {
      continue;
    }
    const prev = byName.get(parsed.name);
    if (prev === "FAIL" || parsed.status === "FAIL") {
      byName.set(parsed.name, "FAIL");
    } else {
      byName.set(parsed.name, "PASS");
    }
  }

  return [...byName.entries()].map(([name, status]) => ({ name, status }));
}

export function clearIntegrationCaseLog(logPath: string): void {
  if (existsSync(logPath)) {
    unlinkSync(logPath);
  }
}
