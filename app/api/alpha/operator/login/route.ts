import { setOperatorSession, verifyOperatorToken } from "@/lib/alpha/operator-auth";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation, readSmallJson } from "@/lib/http/profile-request";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Unauthorized" }, { status: 403 });
  let body: unknown;
  try {
    body = await readSmallJson(request, 1024);
  } catch {
    return privateJson({ error: "Unauthorized" }, { status: 403 });
  }
  const token = body && typeof body === "object"
    ? String((body as Record<string, unknown>).token ?? "")
    : "";
  if (!verifyOperatorToken(token) || !(await setOperatorSession())) {
    return privateJson({ error: "Unauthorized" }, { status: 403 });
  }
  return privateJson({ ok: true });
}
