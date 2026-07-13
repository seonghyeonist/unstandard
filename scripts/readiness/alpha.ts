import { execSync } from "node:child_process";

function run(command: string): number {
  try {
    execSync(command, { stdio: "inherit" });
    return 0;
  } catch {
    return 1;
  }
}

const integrationExit = run("npm run test:integration");
const smokePass = process.env.UNSTANDARD_READINESS_SMOKE_PASS === "yes";

if (integrationExit !== 0) {
  console.error("readiness:alpha FAIL — integration tests did not pass");
  process.exit(1);
}

if (!smokePass) {
  console.error("readiness:alpha BLOCKED_EXTERNAL — deployed smoke not recorded");
  process.exit(2);
}

console.log("readiness:alpha PASS");
