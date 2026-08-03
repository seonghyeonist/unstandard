import { signOutCurrentUser } from "@/lib/auth/server";
import { privateJson } from "@/lib/http/private-json";

export async function POST() {
  await signOutCurrentUser();
  return privateJson({ ok: true });
}
