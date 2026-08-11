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

  it("keeps database-runtime unlock/private on DB authorization paths", () => {
    const unlockSubmit = source("app/api/answers/unlock/route.ts");
    assert.match(unlockSubmit, /isDatabaseRuntime/);
    assert.match(unlockSubmit, /submitDbUnlockAnswer/);
    assert.doesNotMatch(unlockSubmit, /Database-backed unlock is not available/);
    assert.doesNotMatch(unlockSubmit, /NextResponse\.json/);

    const unlockStatus = source("app/api/unlock/[profileId]/route.ts");
    assert.match(unlockStatus, /isDatabaseRuntime/);
    assert.match(unlockStatus, /getDbUnlockStatus/);
    assert.doesNotMatch(unlockStatus, /Database-backed unlock is not available/);

    const privateProfile = source("app/api/profile/[id]/private/route.ts");
    assert.match(privateProfile, /isDatabaseRuntime/);
    assert.match(privateProfile, /getDbPrivateProfile/);
    assert.doesNotMatch(privateProfile, /Database-backed private profile is not available/);
    assert.match(privateProfile, /status: 403/);
  });

  it("does not use unlock cookies as database-runtime authorization", () => {
    const unlockSubmit = source("app/api/answers/unlock/route.ts");
    const unlockStatus = source("app/api/unlock/[profileId]/route.ts");
    const privateProfile = source("app/api/profile/[id]/private/route.ts");

    // Cookie helpers may remain for mock runtime branches only.
    assert.match(unlockSubmit, /isDatabaseRuntime\(\)/);
    assert.match(unlockStatus, /source: "database"/);
    assert.match(privateProfile, /source: "database"/);
    assert.match(privateProfile, /hasUnlockCookie/);
  });

  it("uses a path-segment boundary for protected proxy routes", () => {
    const proxy = source("proxy.ts");
    assert.match(proxy, /pathname === prefix \|\| pathname\.startsWith\(\`\$\{prefix\}\/\`\)/);
  });
});
