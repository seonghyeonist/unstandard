import { hasOperatorSession } from "@/lib/alpha/operator-auth";
import { privateJson } from "@/lib/http/private-json";

export async function GET() {
  return privateJson({ authorized: await hasOperatorSession() });
}
