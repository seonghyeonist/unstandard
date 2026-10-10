import { EXPECTED_MIGRATION_LEDGER } from "../../../lib/db/migration-manifest";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { closeIntegrationDatabases, createIntegrationSql } from "../helpers";
import {
  assertRequiredApplicationTablesWithSql,
  computeApplicationSchemaSnapshotWithSql,
  readMigrationLedgerWithSql,
} from "../../../lib/db/run-migrations";
import {
  DRIZZLE_MIGRATIONS_SCHEMA,
  DRIZZLE_MIGRATIONS_TABLE,
  getDrizzleMigrationConfig,
} from "../../../lib/db/migration-contract";
import {
  DEFAULT_CLOSED_ALPHA_SEED,
  type SeedDataset,
  seedClosedAlphaDataWithSql,
} from "../../../lib/db/seed-data";
import { observeIntegrationCase } from "../../../lib/readiness/integration-case-log";

after(async () => closeIntegrationDatabases());

describe("integration: migrations and seed", () => {
  it("migration_schema_inventory_read_only", async () => {
    const sql = createIntegrationSql();

    await observeIntegrationCase("migration_schema_inventory_read_only", async () => {
      const config = getDrizzleMigrationConfig();
      assert.equal(config.migrationsSchema, DRIZZLE_MIGRATIONS_SCHEMA);
      assert.equal(config.migrationsTable, DRIZZLE_MIGRATIONS_TABLE);

      const ledger = await readMigrationLedgerWithSql(sql);
      assert.equal(ledger.length, EXPECTED_MIGRATION_LEDGER.length, "alpha RC expects the checked-in migration ledger");
      const snapshot = await computeApplicationSchemaSnapshotWithSql(sql);
      assert.match(snapshot.schemaContentDigest, /^[a-f0-9]{64}$/u);
      assert.deepEqual(await assertRequiredApplicationTablesWithSql(sql), []);
    });
  });

  it("seed_idempotency", async () => {
    const sql = createIntegrationSql();

    await observeIntegrationCase("seed_idempotency", async () => {
      // questions.id is uuid — non-UUID markers fail on real PostgreSQL.
      const uniqueSuffix = `${process.pid}-${Date.now()}`;
      const dataset: SeedDataset = {
        question: {
          id: randomUUID(),
          prompt: `integration seed prompt ${uniqueSuffix}`,
          helper: `helper-${uniqueSuffix}`,
          active: true,
        },
        unlockQuestion: {
          id: randomUUID(),
          prompt: `integration unlock prompt ${uniqueSuffix}`,
          helper: `unlock-helper-${uniqueSuffix}`,
          active: true,
        },
        appConfig: {
          key: `alpha.integration.seed.${uniqueSuffix}`,
          value: { marker: uniqueSuffix, enabled: true },
        },
        unlockQuestionConfig: {
          key: `unlock.integration.seed.${uniqueSuffix}`,
          value: { questionId: "00000000-0000-4000-8000-000000000001" },
        },
      };

      try {
        const first = await seedClosedAlphaDataWithSql(sql, dataset);
        assert.equal(first.questionChanged, true);
        assert.equal(first.appConfigChanged, true);

        const [questionBefore] = await sql`
          SELECT id, prompt, helper, active, created_at::text AS created_at
          FROM questions
          WHERE id = ${dataset.question.id}
        `;
        const [configBefore] = await sql`
          SELECT key, value, updated_at::text AS updated_at
          FROM app_config
          WHERE key = ${dataset.appConfig.key}
        `;
        assert.ok(questionBefore);
        assert.ok(configBefore);

        const second = await seedClosedAlphaDataWithSql(sql, dataset);
        assert.equal(second.questionChanged, false);
        assert.equal(second.appConfigChanged, false);

        const changedDataset: SeedDataset = {
          ...dataset,
          question: {
            ...dataset.question,
            prompt: `${dataset.question.prompt}::changed`,
          },
          appConfig: {
            ...dataset.appConfig,
            value: { ...dataset.appConfig.value, enabled: false, changed: true },
          },
        };

        const third = await seedClosedAlphaDataWithSql(sql, changedDataset);
        assert.equal(third.questionChanged, true);
        assert.equal(third.appConfigChanged, true);

        const [configMid] = await sql`
          SELECT key, value, updated_at::text AS updated_at
          FROM app_config
          WHERE key = ${dataset.appConfig.key}
        `;
        assert.notEqual(
          String(configMid?.updated_at),
          String(configBefore?.updated_at),
          "updated_at must change on real config mutation",
        );

        const fourth = await seedClosedAlphaDataWithSql(sql, changedDataset);
        assert.equal(fourth.questionChanged, false);
        assert.equal(fourth.appConfigChanged, false);

        const questions = await sql`
          SELECT id, prompt, helper, active, created_at::text AS created_at
          FROM questions
          WHERE id = ${dataset.question.id}
        `;
        const configs = await sql`
          SELECT key, value, updated_at::text AS updated_at
          FROM app_config
          WHERE key = ${dataset.appConfig.key}
        `;
        assert.equal(questions.length, 1);
        assert.equal(configs.length, 1);
        assert.equal(questions[0]?.created_at, questionBefore?.created_at);
        assert.equal(questions[0]?.prompt, changedDataset.question.prompt);
        assert.deepEqual(configs[0]?.value, changedDataset.appConfig.value);
        assert.equal(configs[0]?.updated_at, configMid?.updated_at);

        // Default closed-alpha seed remains independently seedable and unused for mutation.
        assert.ok(DEFAULT_CLOSED_ALPHA_SEED.question.id);
      } finally {
        await sql`DELETE FROM questions WHERE id = ${dataset.question.id}`;
        await sql`DELETE FROM questions WHERE id = ${dataset.unlockQuestion.id}`;
        await sql`DELETE FROM app_config WHERE key = ${dataset.appConfig.key}`;
        await sql`DELETE FROM app_config WHERE key = ${dataset.unlockQuestionConfig.key}`;
      }
    });
  });
});
