import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("protected route boundaries", () => {
  it("server-protects app and onboarding layouts", () => {
    assert.match(source("app/app/layout.tsx"), /requirePageUser\(\)/);
    assert.match(source("app/onboarding/layout.tsx"), /requirePageUser\(\{ requireOnboarded: false \}\)/);
  });

  it("keeps private unlock and profile routes fail-closed in database runtime", () => {
    for (const route of [
      "app/api/answers/unlock/route.ts",
      "app/api/unlock/[profileId]/route.ts",
      "app/api/profile/[id]/private/route.ts",
    ]) {
      const routeSource = source(route);
      assert.match(routeSource, /isDatabaseRuntime/);
      assert.match(routeSource, /Database-backed/);
      assert.match(routeSource, /status: 503/);
      assert.doesNotMatch(routeSource, /NextResponse\.json/);
    }
  });

  it("uses a path-segment boundary for protected proxy routes", () => {
    const proxy = source("proxy.ts");
    assert.match(proxy, /pathname === prefix \|\| pathname\.startsWith\(\`\$\{prefix\}\/\`\)/);
  });
});
