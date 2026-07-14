import { auditWorkspaceForLegacyBackend } from "../../lib/guard/no-legacy-backend-audit";

const result = auditWorkspaceForLegacyBackend();

if (!result.ok) {
  console.error("guard:no-legacy-backend FAIL — active runtime/deployment path still depends on retired platform");
  for (const failure of result.failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "guard:no-legacy-backend PASS — no active runtime or current deployment path depends on the retired platform",
);
