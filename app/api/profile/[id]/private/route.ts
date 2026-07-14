import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { getPrivateProfileContent } from "@/lib/data/mock-private.server";
import { publicProfiles } from "@/lib/data/mock-public";
import { hasUnlockCookie } from "@/lib/server/unlock-cookies";

/**
 * Mock-backed private profile content.
 * - Existence is checked against mock `publicProfiles` IDs, not Neon profile ownership.
 * - Unlock is an unlock cookie check, not a DB unlock row.
 * - HTTP 404 for unknown mock IDs is not Neon cross-user authorization denial.
 * DB-backed A/B private-profile proof remains future/not-applicable until a Neon route exists.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid profile id" }, { status: 400 });
  }

  const exists = publicProfiles.some((profile) => profile.id === id);
  if (!exists) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const unlocked = await hasUnlockCookie(id, user.id);
  if (!unlocked) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const privateContent = getPrivateProfileContent(id);
  if (!privateContent) {
    return NextResponse.json({ error: "Private content not found" }, { status: 404 });
  }

  return NextResponse.json(privateContent);
}
