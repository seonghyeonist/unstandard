import "server-only";
import { hasOperatorSession } from "@/lib/alpha/operator-auth";
import { supportRepository } from "@/lib/db/repositories/support.repository";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation, readSmallJson } from "@/lib/http/profile-request";
import { parseSupportUpdate } from "@/lib/server/support/contracts";
import { isUuid } from "@/lib/server/unlock/uuid";

export async function GET() {
  if (!(await hasOperatorSession())) return privateJson({ error: "Unauthorized" }, { status: 403 });
  try { return privateJson({ tickets: await supportRepository.listForOperator() }); }
  catch { return privateJson({ error: "Support unavailable" }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOriginMutation(request) || !(await hasOperatorSession())) return privateJson({ error: "Unauthorized" }, { status: 403 });
  let body: unknown;
  try { body = await readSmallJson(request, 12288); }
  catch { return privateJson({ error: "Invalid support update" }, { status: 422 }); }
  const ticketId = body && typeof body === "object" ? (body as Record<string, unknown>).ticketId : null;
  const input = parseSupportUpdate(body);
  if (typeof ticketId !== "string" || !isUuid(ticketId) || !input) return privateJson({ error: "Invalid support update" }, { status: 422 });
  try {
    const updated = await supportRepository.update(ticketId, input);
    return updated ? privateJson({ ok: true }) : privateJson({ error: "Ticket changed or unavailable" }, { status: 409 });
  } catch { return privateJson({ error: "Support unavailable" }, { status: 503 }); }
}
