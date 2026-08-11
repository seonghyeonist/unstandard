import { appendFileSync, mkdirSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ProofCase } from "@/lib/readiness/proof-artifact";
import { REQUIRED_INTEGRATION_CASES } from "@/lib/readiness/proof-constants";

/**
 * Integration case observation log.
 * Cases are recorded only after the corresponding assertion body completes.
 * Duplicate observations are rejected — they do not silently collapse.
 */
export function getIntegrationCaseLogPath(): string | null {
  const path = process.env.UNSTANDARD_INTEGRATION_CASE_LOG?.trim();
  return path || null;
}

export function recordIntegrationCase(name: string, status: "PASS" | "FAIL"): void {
  const path = getIntegrationCaseLogPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  // Whitelisted fields only — never credentials or database URLs.
  appendFileSync(path, `${JSON.stringify({ name, status })}\n`, "utf8");
}

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

export type ObservationAggregation =
  | {
      ok: true;
      cases: ProofCase[];
    }
  | {
      ok: false;
      failures: string[];
      cases: ProofCase[];
    };

/**
 * Aggregate observation JSONL with strict semantics:
 * - malformed line → fail
 * - unknown case → fail
 * - duplicate observation of same name → fail
 * - singleton FAIL remains FAIL
 */
export function aggregateIntegrationObservations(
  logPath: string,
  requiredNames: readonly string[] = REQUIRED_INTEGRATION_CASES,
): ObservationAggregation {
  const failures: string[] = [];
  const required = new Set(requiredNames);
  const observations: Array<{ name: string; status: "PASS" | "FAIL" }> = [];

  if (!existsSync(logPath)) {
    return {
      ok: false,
      failures: ["observation log missing"],
      cases: [],
    };
  }

  const lines = readFileSync(logPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      failures.push("malformed observation JSONL line");
      continue;
    }

    if (!parsed || typeof parsed !== "object") {
      failures.push("malformed observation object");
      continue;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.name !== "string" || (record.status !== "PASS" && record.status !== "FAIL")) {
      failures.push("malformed observation fields");
      continue;
    }

    if (Object.keys(record).some((key) => key !== "name" && key !== "status")) {
      failures.push(`observation for "${record.name}" contains non-whitelisted fields`);
      continue;
    }

    if (!required.has(record.name)) {
      failures.push(`unknown integration case observation: ${record.name}`);
      continue;
    }

    observations.push({ name: record.name, status: record.status });
  }

  const counts = new Map<string, number>();
  const byName = new Map<string, "PASS" | "FAIL">();
  for (const item of observations) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
    const prev = byName.get(item.name);
    if (prev === "FAIL" || item.status === "FAIL") {
      byName.set(item.name, "FAIL");
    } else {
      byName.set(item.name, "PASS");
    }
  }

  for (const [name, count] of counts) {
    if (count > 1) {
      failures.push(`duplicate observation for required case: ${name}`);
    }
  }

  for (const name of requiredNames) {
    if (!byName.has(name)) {
      failures.push(`missing observation for required case: ${name}`);
    }
  }

  const cases: ProofCase[] = requiredNames.map((name) => ({
    name,
    status: byName.get(name) ?? "FAIL",
  }));

  if (failures.length > 0) {
    return { ok: false, failures, cases };
  }

  return { ok: true, cases };
}

/** @deprecated Prefer aggregateIntegrationObservations for strict semantics. */
export function readObservedIntegrationCases(logPath: string): ProofCase[] {
  const aggregated = aggregateIntegrationObservations(logPath);
  return aggregated.cases;
}

export function clearIntegrationCaseLog(logPath: string): void {
  if (existsSync(logPath)) {
    unlinkSync(logPath);
  }
}
