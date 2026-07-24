import {
  auditWorkspaceForLegacyBackend,
  formatLegacyGuardPassMessage,
} from "../../lib/guard/no-legacy-backend-audit";

const result = auditWorkspaceForLegacyBackend();

if (!result.ok) {
  console.error(
    "guard:no-legacy-backend FAIL — active runtime/deployment path still depends on retired platform",
  );
  for (const failure of result.failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(formatLegacyGuardPassMessage(result));
  process.exitCode = 0;
}
