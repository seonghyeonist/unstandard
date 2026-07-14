/**
 * Active-path legacy backend audit.
 *
 * PASS means: no active runtime or current deployment path depends on the
 * retired platform.
 * It does NOT mean the repository contains no historical mention of that platform.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Exact reviewed historical allowlist — no wildcards. */
export const HISTORICAL_LEGACY_ALLOWLIST = [
  "docs/SUPABASE_TO_NEON_CUTOVER.md",
  "docs/LEGACY_BACKEND_RETIREMENT.md",
] as const;

const GUARD_SELF = "scripts/guard/no-legacy-backend.ts";
const GUARD_LIB = "lib/guard/no-legacy-backend-audit.ts";
const GUARD_TEST = "tests/no-legacy-backend-guard.test.ts";

export const ACTIVE_LEGACY_PATTERNS = [
  "@supabase/",
  "createBrowserClient",
  "createServerClient",
  "from \"@supabase",
  "from '@supabase",
  "NEXT_PUBLIC_SUPABASE",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "UNSTANDARD_SUPABASE",
  "sb_publishable",
  "smoke:rls",
  "db:staging:push",
  "db:staging:dry-run",
  "dual-read",
  "dual-write",
  "dualRead",
  "dualWrite",
] as const;

/** Broad platform-name patterns allowed only on the historical allowlist. */
export const PLATFORM_NAME_PATTERNS = ["supabase", "@supabase"] as const;

const ACTIVE_PATH_PREFIXES = [
  "app/",
  "lib/",
  "scripts/",
  ".github/workflows/",
] as const;

const ACTIVE_FILES = [
  "middleware.ts",
  "package.json",
  ".env.example",
  "drizzle.config.ts",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
] as const;

export type LegacyGuardFinding = {
  path: string;
  pattern: string;
  line?: string;
};

function isAllowlistedHistorical(path: string): boolean {
  return (HISTORICAL_LEGACY_ALLOWLIST as readonly string[]).includes(path);
}

function isGuardInfrastructure(path: string): boolean {
  return path === GUARD_SELF || path === GUARD_LIB || path === GUARD_TEST;
}

function isActivePath(path: string): boolean {
  if (ACTIVE_FILES.includes(path as (typeof ACTIVE_FILES)[number])) return true;
  return ACTIVE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isMigrationAuditModule(path: string): boolean {
  return path.startsWith("lib/migration-audit/");
}

export function assertNoWildcardAllowlist(allowlist: readonly string[]): string[] {
  const failures: string[] = [];
  for (const entry of allowlist) {
    if (entry.includes("*") || entry.includes("?") || entry.endsWith("/")) {
      failures.push(`wildcard allowlist entry forbidden: ${entry}`);
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
  if (isMigrationAuditModule(path)) {
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

  // Platform name in active code is still banned outside allowlist.
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
 * Fail if an allowlisted historical document is imported/required by runtime.
 */
export function findRuntimeImportsOfHistoricalDocs(
  filePath: string,
  content: string,
): LegacyGuardFinding[] {
  if (!isActivePath(filePath) || isGuardInfrastructure(filePath) || isAllowlistedHistorical(filePath)) {
    return [];
  }
  // Documentation imports into app/lib/scripts are forbidden.
  if (!(filePath.startsWith("app/") || filePath.startsWith("lib/") || filePath.startsWith("scripts/"))) {
    return [];
  }

  const findings: LegacyGuardFinding[] = [];
  for (const allowed of HISTORICAL_LEGACY_ALLOWLIST) {
    if (content.includes(allowed) || content.includes(allowed.replace(/^docs\//, ""))) {
      // Require explicit path-like reference, not mere platform name.
      const pathRe = new RegExp(
        allowed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "[\\\\/]"),
        "i",
      );
      if (pathRe.test(content)) {
        findings.push({
          path: filePath,
          pattern: allowed,
          line: `runtime reference to historical allowlisted document ${allowed}`,
        });
      }
    }
  }
  return findings;
}

export function auditWorkspaceForLegacyBackend(cwd = process.cwd()): {
  ok: boolean;
  findings: LegacyGuardFinding[];
  failures: string[];
} {
  const findings: LegacyGuardFinding[] = [];
  const failures: string[] = [];

  failures.push(...assertNoWildcardAllowlist(HISTORICAL_LEGACY_ALLOWLIST));

  const tracked = execSync("git ls-files", { cwd, encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const path of tracked) {
    if (path.startsWith("node_modules/") || path.endsWith(".lock")) {
      // package-lock handled separately for direct deps only via package.json.
      continue;
    }
    if (!existsSync(join(cwd, path))) continue;
    // Skip binary-ish / lock noise
    if (path === "package-lock.json") continue;

    let content: string;
    try {
      content = readFileSync(join(cwd, path), "utf8");
    } catch {
      continue;
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
    // Non-active docs mentioning the platform outside allowlist fail.
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
      failures.push(`${finding.path}: ${finding.pattern}${finding.line ? ` (${finding.line})` : ""}`);
    }
  }

  return { ok: failures.length === 0, findings, failures };
}
