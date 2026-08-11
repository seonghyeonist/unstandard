import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HISTORICAL_AUDIT_MARKER,
  HISTORICAL_LEGACY_ALLOWLIST,
  assertHistoricalMarkerPresent,
  assertNoWildcardAllowlist,
  auditWorkspaceForLegacyBackend,
  findRuntimeImportsOfHistoricalDocs,
  isActivePath,
  scanTextForActivePatterns,
} from "../lib/guard/no-legacy-backend-audit";

describe("no-legacy-backend active-path guard", () => {
  it("rejects active Supabase import", () => {
    const findings = scanTextForActivePatterns(
      "lib/db/client.ts",
      'import { createClient } from "@supabase/supabase-js";\n',
    );
    assert.ok(findings.some((f) => f.pattern.includes("@supabase")));
  });

  it("lib/migration-audit is not exempt", () => {
    const findings = scanTextForActivePatterns(
      "lib/migration-audit/old.ts",
      'import { createClient } from "@supabase/supabase-js";\n',
    );
    assert.ok(findings.length > 0);
  });

  it("scans root .cmd / .ps1 / vercel.json", () => {
    assert.equal(isActivePath("RUN_NEON_STAGING_BOOTSTRAP.cmd"), true);
    assert.equal(isActivePath("bootstrap.ps1"), true);
    assert.equal(isActivePath("vercel.json"), true);

    const cmd = scanTextForActivePatterns(
      "RUN_NEON_STAGING_BOOTSTRAP.cmd",
      "echo https://xyz.supabase.co\n",
    );
    assert.ok(cmd.some((f) => f.pattern === "supabase.co"));

    const ps1 = scanTextForActivePatterns("tools.ps1", "npx supabase db push\n");
    assert.ok(ps1.some((f) => f.pattern === "supabase db"));

    const vercel = scanTextForActivePatterns(
      "vercel.json",
      '{ "rewrites": [{ "source": "/rest/v1/:path*" }] }\n',
    );
    assert.ok(vercel.some((f) => f.pattern === "/rest/v1"));
  });

  it("rejects direct supabase.co and postgrest/gotrue references", () => {
    assert.ok(
      scanTextForActivePatterns("lib/x.ts", 'const u = "https://abc.supabase.co";\n').some(
        (f) => f.pattern === "supabase.co",
      ),
    );
    assert.ok(
      scanTextForActivePatterns("lib/x.ts", "postgrest client\n").some(
        (f) => f.pattern === "postgrest",
      ),
    );
    assert.ok(
      scanTextForActivePatterns("lib/x.ts", "gotrue helper\n").some((f) => f.pattern === "gotrue"),
    );
  });

  it("historical docs require the HISTORICAL_AUDIT marker", () => {
    const missing = assertHistoricalMarkerPresent(
      "docs/SUPABASE_TO_NEON_CUTOVER.md",
      "# no marker here\n",
    );
    assert.ok(missing.some((f) => f.includes(HISTORICAL_AUDIT_MARKER)));

    const present = assertHistoricalMarkerPresent(
      "docs/SUPABASE_TO_NEON_CUTOVER.md",
      `${HISTORICAL_AUDIT_MARKER}\nSupabase was previous.\n`,
    );
    assert.deepEqual(present, []);
  });

  it("allows historical cutover document content when allowlisted", () => {
    const findings = scanTextForActivePatterns(
      "docs/SUPABASE_TO_NEON_CUTOVER.md",
      "Supabase Auth was the previous platform.\n",
    );
    assert.equal(findings.length, 0);
    assert.ok(HISTORICAL_LEGACY_ALLOWLIST.includes("docs/SUPABASE_TO_NEON_CUTOVER.md"));
  });

  it("forbids wildcard and directory-prefix allowlists", () => {
    const failures = assertNoWildcardAllowlist([
      "docs/*",
      "lib/migration-audit/",
      "docs/ok.md",
    ]);
    assert.ok(failures.some((f) => f.includes("wildcard") || f.includes("directory-prefix")));
  });

  it("rejects historical document imported into runtime", () => {
    const findings = findRuntimeImportsOfHistoricalDocs(
      "lib/config/runtime-mode.ts",
      'import doc from "../../docs/SUPABASE_TO_NEON_CUTOVER.md";\n',
    );
    assert.ok(findings.some((f) => f.pattern.includes("SUPABASE_TO_NEON_CUTOVER")));
  });

  it("rejects active runbook linking historical doc as executable instructions", () => {
    const findings = findRuntimeImportsOfHistoricalDocs(
      "docs/NEON_BOOTSTRAP_RUNBOOK.md",
      "Run docs/SUPABASE_TO_NEON_CUTOVER.md as commands to execute now.\n",
    );
    assert.ok(findings.length > 0);
  });

  it("rejects dual-read and dual-write patterns in active paths", () => {
    const findings = scanTextForActivePatterns(
      "lib/db/repositories/reports.repository.ts",
      "function dualRead() {}\nfunction dualWrite() {}\n",
    );
    assert.ok(findings.some((f) => f.pattern === "dualRead"));
    assert.ok(findings.some((f) => f.pattern === "dualWrite"));
  });

  it("exact allowlist contains no wildcard or directory prefix", () => {
    assert.deepEqual(assertNoWildcardAllowlist(HISTORICAL_LEGACY_ALLOWLIST), []);
  });

  it("workspace audit currently passes on this branch", () => {
    const result = auditWorkspaceForLegacyBackend();
    assert.equal(result.ok, true, result.failures.join("\n"));
    assert.ok(result.activeInspectedCount > 0);
    assert.deepEqual(result.historicalExcluded, [...HISTORICAL_LEGACY_ALLOWLIST]);
  });
});
