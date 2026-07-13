import { execSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { assertTestDatabaseEnv } from "../../lib/config/database-env";
import {
  requireDestructiveTestConfirmation,
  requireTestDatabaseUrl,
} from "../../lib/db/migration-guards";
import { assertDatabaseReachable } from "../../tests/integration/helpers";

function blocked(message: string): never {
  console.error(`BLOCKED_EXTERNAL: ${message}`);
  process.exit(2);
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    blocked("TEST_DATABASE_URL missing");
  }

  try {
    requireTestDatabaseUrl(testUrl);
    assertTestDatabaseEnv();
    requireDestructiveTestConfirmation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "integration prerequisites failed";
    if (message.includes("TEST_DATABASE_URL") || message.includes("UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST")) {
      blocked(message);
    }
    fail(message);
  }

  try {
    await assertDatabaseReachable(testUrl);
  } catch {
    fail("unable to connect to TEST_DATABASE_URL");
  }

  const env = {
    ...process.env,
    TEST_DATABASE_URL: testUrl,
    DATABASE_ENV: "test",
  };

  try {
    execSync("tsx --test tests/integration/suite/*.test.ts", {
      env,
      stdio: "inherit",
    });
  } catch {
    fail("integration suite failed");
  }

  console.log("test:integration PASS");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "integration runner failed";
  if (message.includes("BLOCKED_EXTERNAL")) {
    blocked(message.replace("BLOCKED_EXTERNAL: ", ""));
  }
  fail(message);
});
