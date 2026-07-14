import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { neon } from "@neondatabase/serverless";
import { getIntegrationDatabaseUrl } from "../helpers";
import {
  assertRequiredApplicationTables,
  computeApplicationSchemaFingerprint,
  readMigrationLedger,
  runDrizzleMigrations,
} from "../../../lib/db/run-migrations";
import {
  DRIZZLE_MIGRATIONS_SCHEMA,
  DRIZZLE_MIGRATIONS_TABLE,
  compareMigrationLedgers,
  getDrizzleMigrationConfig,
} from "../../../lib/db/migration-contract";
import {
  SEED_APP_CONFIG_KEY,
  seedClosedAlphaData,
  seedOnboardingQuestion,
} from "../../../lib/db/seed-data";
import { observeIntegrationCase } from "../../../lib/readiness/integration-case-log";

describe("integration: migrations and seed", () => {
  it("migration_second_run_noop", async () => {
    const url = getIntegrationDatabaseUrl();

    await observeIntegrationCase("migration_second_run_noop", async () => {
      const config = getDrizzleMigrationConfig();
      assert.equal(config.migrationsSchema, DRIZZLE_MIGRATIONS_SCHEMA);
      assert.equal(config.migrationsTable, DRIZZLE_MIGRATIONS_TABLE);

      await runDrizzleMigrations(url);

      const ledgerBefore = await readMigrationLedger(url);
      assert.ok(ledgerBefore.length > 0, "migration ledger must be non-empty after first run");
      const fingerprintBefore = await computeApplicationSchemaFingerprint(url);
      const requiredBefore = await assertRequiredApplicationTables(url);
      assert.deepEqual(requiredBefore, []);

      await runDrizzleMigrations(url);

      const ledgerAfter = await readMigrationLedger(url);
      const fingerprintAfter = await computeApplicationSchemaFingerprint(url);
      const requiredAfter = await assertRequiredApplicationTables(url);

      const ledgerFailures = compareMigrationLedgers(ledgerBefore, ledgerAfter);
      assert.deepEqual(ledgerFailures, [], ledgerFailures.join("; "));
      assert.equal(
        fingerprintBefore,
        fingerprintAfter,
        "application schema fingerprint changed after second migration run",
      );
      assert.deepEqual(requiredAfter, []);
    });
  });

  it("seed_idempotency", async () => {
    const url = getIntegrationDatabaseUrl();

    await observeIntegrationCase("seed_idempotency", async () => {
      await runDrizzleMigrations(url);
      await seedClosedAlphaData(url);

      const sql = neon(url);
      const [questionBefore] = await sql`
        SELECT id, prompt, helper, active, created_at
        FROM questions
        WHERE id = ${seedOnboardingQuestion.id}
      `;
      const [configBefore] = await sql`
        SELECT key, value, updated_at
        FROM app_config
        WHERE key = ${SEED_APP_CONFIG_KEY}
      `;

      assert.ok(questionBefore);
      assert.ok(configBefore);

      await seedClosedAlphaData(url);

      const questions = await sql`
        SELECT id, prompt, helper, active, created_at
        FROM questions
        WHERE id = ${seedOnboardingQuestion.id}
      `;
      const configs = await sql`
        SELECT key, value, updated_at
        FROM app_config
        WHERE key = ${SEED_APP_CONFIG_KEY}
      `;

      assert.equal(questions.length, 1);
      assert.equal(configs.length, 1);

      const questionAfter = questions[0];
      const configAfter = configs[0];

      assert.equal(String(questionAfter?.id), String(questionBefore?.id));
      assert.equal(questionAfter?.prompt, questionBefore?.prompt);
      assert.equal(questionAfter?.helper, questionBefore?.helper);
      assert.equal(questionAfter?.active, questionBefore?.active);
      assert.equal(String(questionAfter?.created_at), String(questionBefore?.created_at));

      assert.equal(configAfter?.key, configBefore?.key);
      assert.deepEqual(configAfter?.value, configBefore?.value);
      assert.equal(
        String(configAfter?.updated_at),
        String(configBefore?.updated_at),
        "identical seed must not bump app_config.updated_at",
      );
    });
  });
});
