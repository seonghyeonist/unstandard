import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HISTORICAL_LEGACY_ALLOWLIST,
  assertNoWildcardAllowlist,
  auditWorkspaceForLegacyBackend,
  findRuntimeImportsOfHistoricalDocs,
  scanEnvExampleForLegacy,
  scanPackageJsonForLegacyDeps,
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

  it("rejects active legacy env variable in .env.example", () => {
    const findings = scanEnvExampleForLegacy("NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\n");
    assert.ok(findings.some((f) => f.pattern.includes("NEXT_PUBLIC_SUPABASE")));
  });

  it("rejects direct legacy dependency in package.json", () => {
    const findings = scanPackageJsonForLegacyDeps(
      JSON.stringify({
        dependencies: { "@supabase/supabase-js": "2.0.0" },
      }),
    );
    assert.ok(findings.some((f) => f.pattern.includes("@supabase/supabase-js")));
  });

  it("allows historical cutover document content", () => {
    const findings = scanTextForActivePatterns(
      "docs/SUPABASE_TO_NEON_CUTOVER.md",
      "Supabase Auth was the previous platform.\n",
    );
    assert.equal(findings.length, 0);
    assert.ok(HISTORICAL_LEGACY_ALLOWLIST.includes("docs/SUPABASE_TO_NEON_CUTOVER.md"));
  });

  it("forbids wildcard allowlists", () => {
    const failures = assertNoWildcardAllowlist(["docs/*", "docs/ok.md"]);
    assert.ok(failures.some((f) => f.includes("wildcard")));
  });

  it("rejects historical document imported into runtime", () => {
    const findings = findRuntimeImportsOfHistoricalDocs(
      "lib/config/runtime-mode.ts",
      'import doc from "../../docs/SUPABASE_TO_NEON_CUTOVER.md";\n',
    );
    assert.ok(findings.some((f) => f.pattern.includes("SUPABASE_TO_NEON_CUTOVER")));
  });

  it("rejects dual-read and dual-write patterns in active paths", () => {
    const findings = scanTextForActivePatterns(
      "lib/db/repositories/reports.repository.ts",
      "function dualRead() {}\nfunction dualWrite() {}\n",
    );
    assert.ok(findings.some((f) => f.pattern === "dualRead"));
    assert.ok(findings.some((f) => f.pattern === "dualWrite"));
  });

  it("workspace audit currently passes on this branch", () => {
    const result = auditWorkspaceForLegacyBackend();
    assert.equal(result.ok, true, result.failures.join("\n"));
  });
});
