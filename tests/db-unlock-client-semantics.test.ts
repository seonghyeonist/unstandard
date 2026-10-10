import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { unlockErrorClientMessage } from "../lib/unlock/unlock-codes.ts";
import { assertUnlockLogSafe, logUnlockEvent } from "../lib/server/unlock/unlock-logger.ts";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("unlock client error semantics", () => {
  it("preserves HTTP status/code instead of collapsing all failures to network ERROR", () => {
    const answersApi = source("lib/api/answers.ts");
    assert.match(answersApi, /kind: "ok" \| "http_error" \| "network_error"/);
    assert.match(answersApi, /NETWORK_ERROR/);
    assert.match(answersApi, /http_error/);
    assert.doesNotMatch(
      answersApi,
      /if \(!response\.ok\) \{\s*return \{ verdict: "ERROR", reasonCodes: \[\] \};/s,
    );
  });

  it("does not render network copy for 503 capability errors", () => {
    const verdict = source("components/question/verdict-message.tsx");
    assert.match(verdict, /UNLOCK_SERVICE_UNAVAILABLE/);
    assert.match(verdict, /errorKind === "network_error"/);
    assert.match(verdict, /열쇠 기능을 잠시 쓸 수 없어요/);
  });

  it("maps 401 to login-expired copy", () => {
    assert.match(unlockErrorClientMessage("UNAUTHORIZED"), /로그인/);
  });

  it("keeps real network copy distinct from capability unavailable", () => {
    const network = "네트워크가 잠시 흔들렸어요";
    const unavailable = unlockErrorClientMessage("UNLOCK_SERVICE_UNAVAILABLE");
    assert.equal(unavailable.includes(network), false);
  });
});

describe("unlock observability redaction", () => {
  it("redacts sensitive keys from structured logs", () => {
    const lines: string[] = [];
    const originalInfo = console.info;
    console.info = (line: string) => {
      lines.push(String(line));
    };
    try {
      logUnlockEvent(
        {
          event: "unlock.test",
          correlationId: "corr-1",
          stage: "ATTEMPT_INSERT",
          status: "ok",
        },
        {
          answerText: "secret-answer-should-not-appear",
          email: "secret@example.com",
          DATABASE_URL: "postgres://secret",
        },
      );
    } finally {
      console.info = originalInfo;
    }

    assert.equal(lines.length, 1);
    assertUnlockLogSafe(lines[0], [
      "secret-answer-should-not-appear",
      "secret@example.com",
      "postgres://secret",
    ]);
    assert.match(lines[0], /\[redacted\]/);
  });
});

describe("profile client fail-closed responses", () => {
  it("never substitutes mock candidates or profiles after authorization errors", async () => {
    const { getCandidates } = await import("../lib/api/candidates");
    const { getProfile } = await import("../lib/api/profiles");
    const originalFetch = globalThis.fetch;
    try {
      for (const status of [401, 403, 409, 503]) {
        globalThis.fetch = async () => new Response("{}", { status });
        await assert.rejects(getCandidates(), new RegExp(String(status)));
        await assert.rejects(getProfile("c1"), new RegExp(String(status)));
      }
      globalThis.fetch = async () => { throw new Error("network down"); };
      await assert.rejects(getCandidates(), /network down/);
    } finally { globalThis.fetch = originalFetch; }
  });
});
