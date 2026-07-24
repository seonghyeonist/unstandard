import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { seedClosedAlphaData } from "../../lib/db/seed-data";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  await seedClosedAlphaData(url);
  console.log("seed complete");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "seed failed");
  process.exit(1);
});
