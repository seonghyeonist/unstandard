import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { privateJson } from "@/lib/http/private-json";
import { consumeRateLimit, requestIpAddress } from "@/lib/security/rate-limit";
import { validateClientEvent } from "@/lib/acquisition/policy";
import { incrementFunnel } from "@/lib/acquisition/acquisition.repository";
export async function POST(request: Request) {
  // Cross-site writes are not accepted; event counts remain untrusted/browser reported.
  if (request.headers.get("origin") !== new URL(request.url).origin) return privateJson({ error: "Invalid origin" }, { status: 403 });
  if (!isDatabaseRuntime()) return privateJson({ error: "Unavailable" }, { status: 503 });
  if (Number(request.headers.get("content-length")) > 1024) return privateJson({ error: "Too large" }, { status: 413 });
  let input;
  try { const body = await request.text(); if (body.length > 1024) throw new Error(); input = validateClientEvent(JSON.parse(body)); }
  catch { return privateJson({ error: "Invalid event" }, { status: 400 }); }
  try {
    const decision = await consumeRateLimit({ scope: "acquisition", subject: requestIpAddress(request) });
    if (!decision.allowed) return privateJson({ error: "Too many requests" }, { status: 429 });
    await incrementFunnel(input.event, input.attribution);
    return privateJson({ accepted: true }, { status: 202 });
  } catch { return privateJson({ error: "Unavailable" }, { status: 503 }); }
}
