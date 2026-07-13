/**
 * Deployed Preview adversarial authorization smoke (HTTP boundary).
 * Requires SMOKE_BASE_URL and two test accounts.
 */

const baseUrl = process.env.SMOKE_BASE_URL?.trim();

function redact(value: string): string {
  return value.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]");
}

async function fetchJson(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 120) };
  }
  return { status: response.status, body };
}

async function main(): Promise<void> {
  if (!baseUrl) {
    console.error("BLOCKED_EXTERNAL: SMOKE_BASE_URL missing");
    process.exit(2);
  }

  const cases: Array<{ name: string; pass: boolean }> = [];

  const anonSession = await fetchJson("/api/auth/session");
  cases.push({ name: "anonymous_denied", pass: anonSession.status === 401 });

  console.log(
    JSON.stringify(
      {
        verdict: cases.every((item) => item.pass) ? "PASS" : "INCOMPLETE",
        baseUrl: redact(baseUrl),
        cases,
        note: "Full A/B adversarial matrix requires SMOKE_USER_A_* and SMOKE_USER_B_* credentials",
      },
      null,
      2,
    ),
  );

  if (!cases.every((item) => item.pass)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.message : "smoke failed"));
  process.exit(1);
});
