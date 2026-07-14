import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  PRIVATE_NO_STORE_CACHE_CONTROL,
  assertPrivateNoStoreCacheControl,
  privateJson,
} from "../lib/http/private-json";

describe("session / private-profile / unlock cache contracts", () => {
  it("session route uses privateJson for every response including errors", () => {
    const source = readFileSync(join(process.cwd(), "app/api/auth/session/route.ts"), "utf8");
    assert.match(source, /from "@\/lib\/http\/private-json"/);
    assert.match(source, /privateJson\(\{ user: null \}, \{ status: 401 \}\)/);
    assert.match(source, /status: 503/);
    assert.match(source, /status: 500/);
    assert.doesNotMatch(source, /NextResponse\.json/);
  });

  it("private-profile route uses privateJson for 401/400/403/404/200", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/profile/[id]/private/route.ts"),
      "utf8",
    );
    assert.match(source, /from "@\/lib\/http\/private-json"/);
    assert.match(source, /status: 401/);
    assert.match(source, /status: 400/);
    assert.match(source, /status: 403/);
    assert.match(source, /status: 404/);
    assert.doesNotMatch(source, /NextResponse\.json/);
  });

  it("unlock GET route uses privateJson", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/unlock/[profileId]/route.ts"),
      "utf8",
    );
    assert.match(source, /from "@\/lib\/http\/private-json"/);
    assert.doesNotMatch(source, /NextResponse\.json/);
  });

  it("anonymous and authenticated shaped responses are private/no-store and not public", async () => {
    const anonymous = privateJson({ user: null }, { status: 401 });
    const authenticated = privateJson({
      user: { nickname: "Alpha", onboarded: true, idPrefix: "aaaaaaaa" },
    });
    const forbidden = privateJson({ error: "Forbidden" }, { status: 403 });
    const okProfile = privateJson({ answers: [] }, { status: 200 });

    for (const response of [anonymous, authenticated, forbidden, okProfile]) {
      const cacheControl = response.headers.get("Cache-Control");
      assert.equal(cacheControl, PRIVATE_NO_STORE_CACHE_CONTROL);
      assert.deepEqual(assertPrivateNoStoreCacheControl(cacheControl), []);
      assert.doesNotMatch(cacheControl ?? "", /\bpublic\b/i);
      assert.match(response.headers.get("Vary") ?? "", /Cookie/);
    }
  });
});
