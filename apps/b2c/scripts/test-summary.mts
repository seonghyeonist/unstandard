import { spawnSync } from "node:child_process";

const action = process.argv[2];
const command = action === "db" ? ["python", ["scripts/test-postgres.py"]]
  : action === "synthetic" ? ["python", ["scripts/test-postgres.py", "payment"]]
  : action === "unit" ? ["npm", ["test"]]
  : action === "all" ? ["npm", ["run", "check"]] : undefined;
if (!command) {
  console.log(JSON.stringify({ layer: "local", status: "FAIL", reason: "unknown_suite" }));
  process.exitCode = 1;
} else {
  const [exe, args] = command as [string, string[]];
  const result = spawnSync(exe, args, { encoding: "utf8", maxBuffer: 12 * 1024 * 1024 });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  let status = result.status;
  if (action === "all" && status === 0) {
    const db = spawnSync("python", ["scripts/test-postgres.py"], { stdio: "inherit" });
    status = db.status;
  }
  const blocked = status === 78;
  console.log(JSON.stringify({ layer: action, status: status === 0 ? "PASS" : blocked ? "BLOCKED" : "FAIL",
    ...(blocked ? { reason: "postgres_tools_unavailable" } : {}) }));
  process.exitCode = status ?? 1;
}
