/**
 * CLI entry for real PostgreSQL integration proofs.
 *
 * Exit codes are set at this outer boundary only (process.exitCode).
 * Runner-core never calls process.exit after allocating the observation log.
 */

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import {
  ExternalBlockError,
  IntegrationExecutionError,
  mapIntegrationErrorToExitCode,
  runIntegrationProofCore,
} from "../../lib/readiness/integration-runner-core";

async function main(): Promise<void> {
  try {
    await runIntegrationProofCore();
    process.exitCode = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "integration runner failed";
    if (error instanceof ExternalBlockError) {
      console.error(`BLOCKED_EXTERNAL: ${message}`);
    } else if (error instanceof IntegrationExecutionError) {
      console.error(`FAIL: ${message}`);
    } else {
      console.error(`FAIL: ${message}`);
    }
    process.exitCode = mapIntegrationErrorToExitCode(error);
  }
}

void main();
