import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { buildAlphaMetricsSnapshot } from "../../lib/alpha/metrics-snapshot";

async function main(): Promise<void> {
  const snapshot = await buildAlphaMetricsSnapshot();
  console.log(JSON.stringify(snapshot, null, 2));
}

main().catch(() => {
  console.error("ALPHA_METRICS_UNAVAILABLE");
  process.exit(1);
});
