import { spawnSync } from "node:child_process";

const SUPERVISOR_TIMEOUT_MS = 20 * 60 * 1_000;
const command = process.execPath;
const args = ["--import", "tsx", "scripts/test/integration.ts"];

const result = spawnSync(command, args, {
  cwd: process.cwd(),
  env: process.env,
  killSignal: "SIGKILL",
  shell: false,
  stdio: "inherit",
  timeout: SUPERVISOR_TIMEOUT_MS,
});

const timedOut = result.error
  ? (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT"
  : false;
const errorCode = result.error
  ? timedOut
    ? "INTEGRATION_SUPERVISOR_TIMEOUT"
    : (result.error as NodeJS.ErrnoException).code ?? "SUPERVISOR_SPAWN_FAILED"
  : null;
const exitStatus = timedOut ? 124 : (result.status ?? 1);

console.info(JSON.stringify({
  event: "integration.process_exit",
  status: exitStatus,
  signal: result.signal,
  error_code: errorCode,
  timeout_ms: SUPERVISOR_TIMEOUT_MS,
}));

process.exitCode = exitStatus === 0 ? 0 : 1;
