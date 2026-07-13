import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { neon } from "@neondatabase/serverless";
import { onboardingQuestion } from "../../lib/data/mock-public";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = neon(url);

  await sql`
    INSERT INTO questions (id, prompt, helper, active)
    VALUES (
      ${onboardingQuestion.id},
      ${onboardingQuestion.prompt},
      ${onboardingQuestion.helper ?? null},
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      prompt = EXCLUDED.prompt,
      helper = EXCLUDED.helper,
      active = EXCLUDED.active
  `;

  await sql`
    INSERT INTO app_config (key, value)
    VALUES ('alpha.closed', '{"enabled": true}'::jsonb)
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now()
  `;

  console.log("seed complete");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "seed failed");
  process.exit(1);
});
