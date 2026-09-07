import { clearOperatorSession, hasOperatorSession } from "@/lib/alpha/operator-auth";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation } from "@/lib/http/profile-request";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request) || !(await hasOperatorSession())) {
    return privateJson({ error: "Unauthorized" }, { status: 403 });
  }
  await clearOperatorSession();
  return privateJson({ ok: true });
}
