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

const ENV_KEYS = [
  "ANSWERS_PERSISTENCE_ADAPTER",
  "UNSTANDARD_SUPABASE_URL",
  "UNSTANDARD_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

function snapshotEnv(): Record<(typeof ENV_KEYS)[number], string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
    (typeof ENV_KEYS)[number],
    string | undefined
  >;
}

function restoreEnv(snapshot: Record<(typeof ENV_KEYS)[number], string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  run: () => void,
): void {
  const snapshot = snapshotEnv();
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
    restoreEnv(snapshot);
  }
}

describe("answers persistence activation gate", () => {
  it("is disabled when ANSWERS_PERSISTENCE_ADAPTER is missing", () => {
    withEnv(
      {
        ANSWERS_PERSISTENCE_ADAPTER: undefined,
        UNSTANDARD_SUPABASE_URL: "https://staging.supabase.co",
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      },
      () => {
        assert.equal(getAnswersPersistenceAdapter(), "disabled");
        assert.equal(isAnswersPersistenceEnabled(), false);
      },
    );
  });

  it("is disabled when supabase-alpha but Supabase URL/key missing", () => {
    withEnv(
      {
        ANSWERS_PERSISTENCE_ADAPTER: "supabase-alpha",
        UNSTANDARD_SUPABASE_URL: undefined,
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: undefined,
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      },
      () => {
        assert.equal(isAnswersPersistenceEnabled(), false);
      },
    );
  });

  it("is enabled when supabase-alpha and UNSTANDARD Supabase env present", () => {
    withEnv(
      {
        ANSWERS_PERSISTENCE_ADAPTER: "supabase-alpha",
        UNSTANDARD_SUPABASE_URL: "https://staging.supabase.co",
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      },
      () => {
        assert.equal(isAnswersPersistenceEnabled(), true);
      },
    );
  });
});

describe("mapSaveOnboardingAnswerResultToHttp", () => {
  it("maps new answer to 201", () => {
    const mapped = mapSaveOnboardingAnswerResultToHttp(
      saveOnboardingAnswerSuccess("answer-id", false),
    );
    assert.equal(mapped.status, 201);
    assert.deepEqual(mapped.body, { ok: true, answerId: "answer-id" });
  });

  it("maps duplicate answer to 200", () => {
    const mapped = mapSaveOnboardingAnswerResultToHttp(
      saveOnboardingAnswerSuccess("existing-id", true),
    );
    assert.equal(mapped.status, 200);
  });

  it("maps persistence disabled to 503", () => {
    const mapped = mapSaveOnboardingAnswerResultToHttp(
      saveOnboardingAnswerFailure("PERSISTENCE_DISABLED"),
    );
    assert.equal(mapped.status, 503);
  });
});

describe("validateOnboardingAnswerInput", () => {
  it("accepts valid nickname and answer", () => {
    const validated = validateOnboardingAnswerInput({
      nickname: "여름",
      answer: "비 오는 날 카페 창가에 앉아 있었는데, 옆 사람이 우산을 건네줬어요.",
    });
    assert.equal(validated.nickname, "여름");
    assert.match(validated.answer, /카페/);
  });

  it("rejects short answers", () => {
    assert.throws(() =>
      validateOnboardingAnswerInput({
        nickname: "여름",
        answer: "짧음",
      }),
    );
  });
});

describe("toPublicSessionUser with answers persistence", () => {
  it("does not bypass onboarding when answers persistence is enabled", () => {
    const view = toPublicSessionUser(
      { id: "11111111-1111-1111-1111-111111111111" },
      { supabaseAuth: true, answersPersistenceEnabled: true },
    );
    assert.equal(view.onboarded, false);
  });

  it("uses profile onboarded state when provided", () => {
    const view = toPublicSessionUser(
      { id: "11111111-1111-1111-1111-111111111111", onboarded: true, nickname: "민" },
      { supabaseAuth: true, answersPersistenceEnabled: true },
    );
    assert.equal(view.onboarded, true);
    assert.equal(view.nickname, "민");
  });
});
