import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getIntegrationDatabaseUrl } from "../helpers";
import { runDrizzleMigrations } from "../../../lib/db/run-migrations";
import { migrationSetChecksum } from "../../../lib/db/migration-guards";
import { neon } from "@neondatabase/serverless";
import { onboardingQuestion } from "../../../lib/data/mock-public";
import { observeIntegrationCase } from "../../../lib/readiness/integration-case-log";

async function runSeed(url: string): Promise<void> {
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
}

describe("integration: migrations and seed", () => {
  it("migration_second_run_noop", async () => {
    const url = getIntegrationDatabaseUrl();

    await observeIntegrationCase("migration_second_run_noop", async () => {
      const checksumBefore = migrationSetChecksum();

      await runDrizzleMigrations(url);
      await runDrizzleMigrations(url);

      const sql = neon(url);
      const tables = await sql`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename = '__drizzle_migrations'
      `;
      assert.equal(tables.length, 1);

      const checksumAfter = migrationSetChecksum();
      assert.equal(checksumBefore, checksumAfter);
    });
  });

  it("seed_idempotency", async () => {
    const url = getIntegrationDatabaseUrl();

    await observeIntegrationCase("seed_idempotency", async () => {
      await runSeed(url);
      await runSeed(url);

      const sql = neon(url);
      const questions = await sql`SELECT id FROM questions WHERE id = ${onboardingQuestion.id}`;
      assert.equal(questions.length, 1);
      assert.ok(questions[0]);

      const configs = await sql`SELECT key FROM app_config WHERE key = ${"alpha.closed"}`;
      assert.equal(configs.length, 1);
    });
  });
});
