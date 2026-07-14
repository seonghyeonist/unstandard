/**
 * Active-path legacy backend audit.
 *
 * PASS means: no active runtime or current deployment path depends on the
 * retired platform, within the inspected inventory printed on PASS.
 * It does NOT mean the repository contains no historical mention of that platform.
 *
 * No active lib directory may be exempt by prefix. Exact historical allowlist only.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";

/** Exact reviewed historical allowlist — no wildcards, no directory prefixes. */
export const HISTORICAL_LEGACY_ALLOWLIST = [
  "docs/SUPABASE_TO_NEON_CUTOVER.md",
  "docs/LEGACY_BACKEND_RETIREMENT.md",
] as const;

/** Required marker inside every allowlisted historical document. */
export const HISTORICAL_AUDIT_MARKER = "status: HISTORICAL_AUDIT_NOT_EXECUTABLE" as const;

const GUARD_SELF = "scripts/guard/no-legacy-backend.ts";
const GUARD_LIB = "lib/guard/no-legacy-backend-audit.ts";
const GUARD_TEST = "tests/no-legacy-backend-guard.test.ts";

export const ACTIVE_LEGACY_PATTERNS = [
  "@supabase/",
  "supabase.co",
  "postgrest",
  "gotrue",
  "/auth/v1",
  "/rest/v1",
  "createBrowserClient",
  "createServerClient",
  'from "@supabase',
  "from '@supabase",
  "NEXT_PUBLIC_SUPABASE",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "UNSTANDARD_SUPABASE",
  "sb_publishable",
  "service_role",
  "SUPABASE_URL",
  "sb-access-token",
  "sb-refresh-token",
  "sb-auth-token",
  "supabase login",
  "supabase db",
  "supabase start",
  "supabase link",
  "npx supabase",
  "smoke:rls",
  "db:staging:push",
  "db:staging:dry-run",
  "dual-read",
  "dual-write",
  "dualRead",
  "dualWrite",
  "hidden automatic fallback",
] as const;

/** Broad platform-name patterns allowed only on the historical allowlist. */
export const PLATFORM_NAME_PATTERNS = ["supabase", "@supabase"] as const;

const ACTIVE_PATH_PREFIXES = [
  "app/",
  "lib/",
  "scripts/",
  ".github/workflows/",
] as const;

const ACTIVE_ROOT_FILES = [
  "middleware.ts",
  "proxy.ts",
  "instrumentation.ts",
  "package.json",
  ".env.example",
  "drizzle.config.ts",
  "drizzle.config.js",
  "drizzle.config.mjs",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "vercel.json",
] as const;

const ROOT_OPERATOR_EXTENSIONS = [
  ".ts",
  ".js",
  ".mjs",
  ".cjs",
  ".cmd",
  ".ps1",
  ".sh",
] as const;

export type LegacyGuardFinding = {
  path: string;
  pattern: string;
  line?: string;
};

export type LegacyGuardAuditResult = {
  ok: boolean;
  findings: LegacyGuardFinding[];
  failures: string[];
  trackedFileCount: number;
  activeInspectedCount: number;
  historicalExcluded: string[];
};

function isAllowlistedHistorical(path: string): boolean {
  return (HISTORICAL_LEGACY_ALLOWLIST as readonly string[]).includes(path);
}

function isGuardInfrastructure(path: string): boolean {
  return path === GUARD_SELF || path === GUARD_LIB || path === GUARD_TEST;
}

function isRootOnly(path: string): boolean {
  return !path.includes("/") && !path.includes("\\");
}

function isRootOperatorFile(path: string): boolean {
  if (!isRootOnly(path)) return false;
  if ((ACTIVE_ROOT_FILES as readonly string[]).includes(path)) return true;
  if (/^Dockerfile/i.test(path)) return true;
  return ROOT_OPERATOR_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
}

export function isActivePath(path: string): boolean {
  if (isRootOperatorFile(path)) return true;
  return ACTIVE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function assertNoWildcardAllowlist(allowlist: readonly string[]): string[] {
  const failures: string[] = [];
  for (const entry of allowlist) {
    if (
      entry.includes("*") ||
      entry.includes("?") ||
      entry.endsWith("/") ||
      entry.includes("/**") ||
      entry.endsWith("/**")
    ) {
      failures.push(`wildcard allowlist entry forbidden: ${entry}`);
    }
    // Directory-prefix style (e.g. lib/migration-audit/) is forbidden.
    if (entry.endsWith("/") || /\/\*\*$/.test(entry)) {
      failures.push(`directory-prefix allowlist entry forbidden: ${entry}`);
    }
  }
  return failures;
}

export function scanTextForActivePatterns(
  path: string,
  content: string,
): LegacyGuardFinding[] {
  const findings: LegacyGuardFinding[] = [];
  if (isGuardInfrastructure(path) || isAllowlistedHistorical(path)) {
    return findings;
  }
  if (!isActivePath(path)) {
    return findings;
  }

  const lines = content.split("\n");
  for (const pattern of ACTIVE_LEGACY_PATTERNS) {
    const re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    lines.forEach((line, index) => {
      if (re.test(line)) {
        findings.push({ path, pattern, line: `${index + 1}:${line.trim()}` });
      }
    });
  }

  for (const pattern of PLATFORM_NAME_PATTERNS) {
    const re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    lines.forEach((line, index) => {
      if (re.test(line)) {
        findings.push({ path, pattern, line: `${index + 1}:${line.trim()}` });
      }
    });
  }

  return findings;
}

export function scanPackageJsonForLegacyDeps(packageJsonRaw: string): LegacyGuardFinding[] {
  const findings: LegacyGuardFinding[] = [];
  const pkg = JSON.parse(packageJsonRaw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const [name] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (name.startsWith("@supabase/") || name === "supabase") {
      findings.push({
        path: "package.json",
        pattern: name,
        line: `direct dependency: ${name}`,
      });
    }
  }
  return findings;
}

export function scanEnvExampleForLegacy(envExample: string): LegacyGuardFinding[] {
  const findings: LegacyGuardFinding[] = [];
  const banned = [
    "NEXT_PUBLIC_SUPABASE",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_URL",
    "UNSTANDARD_SUPABASE",
  ];
  for (const line of envExample.split("\n")) {
    for (const key of banned) {
      if (line.includes(key)) {
        findings.push({ path: ".env.example", pattern: key, line: line.trim() });
      }
    }
  }
  return findings;
}

/**
 * Fail if an allowlisted historical document is imported/required by runtime
 * or presented as executable current instructions from an active path/runbook.
 */
export function findRuntimeImportsOfHistoricalDocs(
  filePath: string,
  content: string,
): LegacyGuardFinding[] {
  if (isGuardInfrastructure(filePath) || isAllowlistedHistorical(filePath)) {
    return [];
  }

  const isRuntimeOrOperator =
    filePath.startsWith("app/") ||
    filePath.startsWith("lib/") ||
    filePath.startsWith("scripts/") ||
    isRootOperatorFile(filePath);

  const isActiveRunbook =
    filePath.startsWith("docs/") &&
    /(RUNBOOK|CHECKLIST|README|HANDOFF|BOOTSTRAP|POLICY)/i.test(basename(filePath));

  if (!isRuntimeOrOperator && !isActiveRunbook) {
    return [];
  }

  const findings: LegacyGuardFinding[] = [];
  for (const allowed of HISTORICAL_LEGACY_ALLOWLIST) {
    const pathRe = new RegExp(
      allowed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "[\\\\/]"),
      "i",
    );
    if (!pathRe.test(content)) continue;

    if (isRuntimeOrOperator) {
      findings.push({
        path: filePath,
        pattern: allowed,
        line: `runtime/operator reference to historical allowlisted document ${allowed}`,
      });
      continue;
    }

    // Active runbook may mention the audit for reading, but must not frame it
    // as executable current instructions.
    const executableFraming =
      /(?:run|execute|follow|apply|perform)\b[\s\S]{0,80}/i.test(content) &&
      pathRe.test(content) &&
      /(?:steps?|commands?|instructions?|migrate|bootstrap)/i.test(content);

    // Narrower: same line or nearby line couples "run/execute" with the path
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      if (
        pathRe.test(line) &&
        /\b(run|execute|follow these|as commands? to execute|do the following)\b/i.test(line)
      ) {
        findings.push({
          path: filePath,
          pattern: allowed,
          line: `${index + 1}:active runbook treats historical doc as executable (${allowed})`,
        });
      }
    });

    if (executableFraming && findings.length === 0) {
      // Conservatively allow mere citations without action verbs on the same line.
    }
  }
  return findings;
}

export function assertHistoricalMarkerPresent(path: string, content: string): string[] {
  if (!isAllowlistedHistorical(path)) return [];
  if (!content.includes(HISTORICAL_AUDIT_MARKER)) {
    return [
      `${path}: missing required marker ${HISTORICAL_AUDIT_MARKER}`,
    ];
  }
  return [];
}

export function auditWorkspaceForLegacyBackend(cwd = process.cwd()): LegacyGuardAuditResult {
  const findings: LegacyGuardFinding[] = [];
  const failures: string[] = [];

  failures.push(...assertNoWildcardAllowlist(HISTORICAL_LEGACY_ALLOWLIST));

  const tracked = execSync("git ls-files", { cwd, encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const historicalExcluded = [...HISTORICAL_LEGACY_ALLOWLIST];
  let activeInspectedCount = 0;

  for (const path of tracked) {
    if (path.startsWith("node_modules/") || path.endsWith(".lock")) {
      continue;
    }
    if (!existsSync(join(cwd, path))) continue;
    if (path === "package-lock.json") continue;

    let content: string;
    try {
      content = readFileSync(join(cwd, path), "utf8");
    } catch {
      continue;
    }

    failures.push(...assertHistoricalMarkerPresent(path, content));

    const active = isActivePath(path) && !isAllowlistedHistorical(path) && !isGuardInfrastructure(path);
    if (active) {
      activeInspectedCount += 1;
    }

    if (path === "package.json") {
      findings.push(...scanPackageJsonForLegacyDeps(content));
    }
    if (path === ".env.example") {
      findings.push(...scanEnvExampleForLegacy(content));
    }

    findings.push(...scanTextForActivePatterns(path, content));
    findings.push(...findRuntimeImportsOfHistoricalDocs(path, content));
  }

  // Historical docs may contain platform name — verify they remain on allowlist only.
  for (const path of tracked) {
    if (isAllowlistedHistorical(path) || isGuardInfrastructure(path)) continue;
    if (!existsSync(join(cwd, path))) continue;
    let content: string;
    try {
      content = readFileSync(join(cwd, path), "utf8");
    } catch {
      continue;
    }
    if (path.startsWith("docs/") && !isActivePath(path)) {
      for (const pattern of PLATFORM_NAME_PATTERNS) {
        if (new RegExp(pattern, "i").test(content)) {
          findings.push({
            path,
            pattern,
            line: "historical platform mention outside reviewed allowlist",
          });
        }
      }
    }
  }

  if (findings.length > 0) {
    for (const finding of findings) {
      failures.push(
        `${finding.path}: ${finding.pattern}${finding.line ? ` (${finding.line})` : ""}`,
      );
    }
  }

  return {
    ok: failures.length === 0,
    findings,
    failures,
    trackedFileCount: tracked.length,
    activeInspectedCount,
    historicalExcluded,
  };
}

export function formatLegacyGuardPassMessage(result: LegacyGuardAuditResult): string {
  return [
    "guard:no-legacy-backend PASS — inspected inventory only (not a claim of zero historical mentions)",
    `tracked_files=${result.trackedFileCount}`,
    `active_files_inspected=${result.activeInspectedCount}`,
    `historical_files_excluded=${result.historicalExcluded.join(",")}`,
    "findings=0",
  ].join("\n");
}
