import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { neon } from "@neondatabase/serverless";
import { getIntegrationDatabaseUrl } from "../helpers";
import {
  assertRequiredApplicationTables,
  computeApplicationSchemaSnapshot,
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
  DEFAULT_CLOSED_ALPHA_SEED,
  type SeedDataset,
  seedClosedAlphaData,
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
      const beforeSnap = await computeApplicationSchemaSnapshot(url);
      const requiredBefore = await assertRequiredApplicationTables(url);
      assert.deepEqual(requiredBefore, []);

      await runDrizzleMigrations(url);

      const ledgerAfter = await readMigrationLedger(url);
      const afterSnap = await computeApplicationSchemaSnapshot(url);
      const requiredAfter = await assertRequiredApplicationTables(url);

      const ledgerFailures = compareMigrationLedgers(ledgerBefore, ledgerAfter);
      assert.deepEqual(ledgerFailures, [], ledgerFailures.join("; "));
      assert.equal(
        beforeSnap.canonicalJson,
        afterSnap.canonicalJson,
        "canonical schema snapshot changed after second migration run",
      );
      assert.equal(
        beforeSnap.schemaContentDigest,
        afterSnap.schemaContentDigest,
        "schemaContentDigest changed after second migration run",
      );
      assert.deepEqual(requiredAfter, []);
    });
  });

  it("seed_idempotency", async () => {
    const url = getIntegrationDatabaseUrl();

    await observeIntegrationCase("seed_idempotency", async () => {
      await runDrizzleMigrations(url);

      // questions.id is uuid — non-UUID markers fail on real PostgreSQL.
      const uniqueSuffix = `${process.pid}-${Date.now()}`;
      const dataset: SeedDataset = {
        question: {
          id: randomUUID(),
          prompt: `integration seed prompt ${uniqueSuffix}`,
          helper: `helper-${uniqueSuffix}`,
          active: true,
        },
        appConfig: {
          key: `alpha.integration.seed.${uniqueSuffix}`,
          value: { marker: uniqueSuffix, enabled: true },
        },
      };

      const sql = neon(url);
      try {
        const first = await seedClosedAlphaData(url, dataset);
        assert.equal(first.questionChanged, true);
        assert.equal(first.appConfigChanged, true);

        const [questionBefore] = await sql`
          SELECT id, prompt, helper, active, created_at
          FROM questions
          WHERE id = ${dataset.question.id}
        `;
        const [configBefore] = await sql`
          SELECT key, value, updated_at
          FROM app_config
          WHERE key = ${dataset.appConfig.key}
        `;
        assert.ok(questionBefore);
        assert.ok(configBefore);

        const second = await seedClosedAlphaData(url, dataset);
        assert.equal(second.questionChanged, false);
        assert.equal(second.appConfigChanged, false);

        const changedDataset: SeedDataset = {
          question: {
            ...dataset.question,
            prompt: `${dataset.question.prompt}::changed`,
          },
          appConfig: {
            ...dataset.appConfig,
            value: { ...dataset.appConfig.value, enabled: false, changed: true },
          },
        };

        const third = await seedClosedAlphaData(url, changedDataset);
        assert.equal(third.questionChanged, true);
        assert.equal(third.appConfigChanged, true);

        const [configMid] = await sql`
          SELECT key, value, updated_at
          FROM app_config
          WHERE key = ${dataset.appConfig.key}
        `;
        assert.notEqual(
          String(configMid?.updated_at),
          String(configBefore?.updated_at),
          "updated_at must change on real config mutation",
        );

        const fourth = await seedClosedAlphaData(url, changedDataset);
        assert.equal(fourth.questionChanged, false);
        assert.equal(fourth.appConfigChanged, false);

        const questions = await sql`
          SELECT id, prompt, helper, active, created_at
          FROM questions
          WHERE id = ${dataset.question.id}
        `;
        const configs = await sql`
          SELECT key, value, updated_at
          FROM app_config
          WHERE key = ${dataset.appConfig.key}
        `;
        assert.equal(questions.length, 1);
        assert.equal(configs.length, 1);
        assert.equal(String(questions[0]?.created_at), String(questionBefore?.created_at));
        assert.equal(questions[0]?.prompt, changedDataset.question.prompt);
        assert.deepEqual(configs[0]?.value, changedDataset.appConfig.value);
        assert.equal(String(configs[0]?.updated_at), String(configMid?.updated_at));

        // Default closed-alpha seed remains independently seedable and unused for mutation.
        assert.ok(DEFAULT_CLOSED_ALPHA_SEED.question.id);
      } finally {
        await sql`DELETE FROM questions WHERE id = ${dataset.question.id}`;
        await sql`DELETE FROM app_config WHERE key = ${dataset.appConfig.key}`;
      }
    });
  });
});
