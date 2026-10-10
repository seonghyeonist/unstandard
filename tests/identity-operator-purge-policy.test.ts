import assert from "node:assert/strict";
import { it } from "node:test";
import { canOperateSandboxPurges } from "../lib/identity/operator-purge-policy";

const sandboxPreview = {
  VERCEL_ENV: "preview", DATABASE_ENV: "test",
  UNSTANDARD_RUNTIME_MODE: "database", DIDIT_EXPECTED_ENVIRONMENT: "sandbox",
};
it("permits bounded manual erasure only in a Sandbox database Preview", () => {
  assert.equal(canOperateSandboxPurges(sandboxPreview), true);
  assert.equal(canOperateSandboxPurges({ ...sandboxPreview, DATABASE_ENV: "staging" }), true);
});
for (const [key, value] of Object.entries({
  VERCEL_ENV: "production", DATABASE_ENV: "production",
  UNSTANDARD_RUNTIME_MODE: "mock", DIDIT_EXPECTED_ENVIRONMENT: "live",
})) {
  it(`rejects erasure maintenance when ${key} is ${value} or absent`, () => {
    assert.equal(canOperateSandboxPurges({ ...sandboxPreview, [key]: value }), false);
    assert.equal(canOperateSandboxPurges({ ...sandboxPreview, [key]: undefined }), false);
  });
}
