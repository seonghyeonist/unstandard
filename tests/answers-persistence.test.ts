import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAnswersPersistenceAdapter,
  isAnswersPersistenceEnabled,
} from "../lib/config/answers-persistence-mode.ts";
import { mapSaveOnboardingAnswerResultToHttp } from "../lib/server/persistence/answers.http-mapper.ts";
import {
  saveOnboardingAnswerFailure,
  saveOnboardingAnswerSuccess,
} from "../lib/server/persistence/answers.types.ts";
import { validateOnboardingAnswerInput } from "../lib/security/onboarding-validation.ts";
import { toPublicSessionUser } from "../lib/auth/session-view.ts";
import { canMarkProfileOnboarded } from "../lib/server/persistence/onboarding-finalize.ts";

const ENV_KEYS = ["UNSTANDARD_RUNTIME_MODE", "DATABASE_URL"] as const;

function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  run: () => void,
): void {
  const snapshot = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
    (typeof ENV_KEYS)[number],
    string | undefined
  >;

  for (const key of ENV_KEYS) {
    if (key in overrides) {
      const value = overrides[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = snapshot[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("answers persistence activation gate", () => {
  it("is disabled when runtime mode is mock", () => {
    withEnv({ UNSTANDARD_RUNTIME_MODE: "mock", DATABASE_URL: "postgres://test" }, () => {
      assert.equal(getAnswersPersistenceAdapter(), "disabled");
      assert.equal(isAnswersPersistenceEnabled(), false);
    });
  });

  it("is enabled when database runtime and DATABASE_URL are set", () => {
    withEnv(
      { UNSTANDARD_RUNTIME_MODE: "database", DATABASE_URL: "postgres://test" },
      () => {
        assert.equal(getAnswersPersistenceAdapter(), "postgres");
        assert.equal(isAnswersPersistenceEnabled(), true);
      },
    );
  });
});

describe("answers persistence HTTP + validation", () => {
  it("maps success to 201", () => {
    const mapped = mapSaveOnboardingAnswerResultToHttp(
      saveOnboardingAnswerSuccess("answer-id", false),
    );
    assert.equal(mapped.status, 201);
  });

  it("maps disabled persistence to 503", () => {
    const mapped = mapSaveOnboardingAnswerResultToHttp(
      saveOnboardingAnswerFailure("PERSISTENCE_DISABLED"),
    );
    assert.equal(mapped.status, 503);
  });

  it("validates onboarding answer input", () => {
    const validated = validateOnboardingAnswerInput({
      nickname: "민",
      answer: "비 오는 날 카페에서 창밖을 바라봤어요.",
    });
    assert.equal(validated.nickname, "민");
  });

  it("session view never exposes email", () => {
    const view = toPublicSessionUser({
      id: "user-abc",
      email: "secret@example.com",
      nickname: "민",
      onboarded: true,
    });
    assert.equal("email" in view, false);
  });

  it("requires answer + evaluation before onboarded finalize", () => {
    assert.equal(
      canMarkProfileOnboarded({
        existingAnswerId: null,
        existingEvaluationComplete: false,
        answerInserted: true,
        evaluationInserted: false,
      }),
      false,
    );
  });
});
