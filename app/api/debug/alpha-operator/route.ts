import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  generateInviteCode,
  hashInviteCode,
  normalizeEmail,
  requireInvitePepper,
} from "@/lib/auth/invite-crypto";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";
import { alphaInvites } from "@/lib/db/schema/invites";

const TARGET_BRANCH = "cursor/neon-drizzle-better-auth-rebuild-909d";
const RESET_CONFIRMATION = "RESET_ALPHA_TEST_ACCOUNT";
const ALLOWED_EMAILS = new Set([
  "stoprulker@gmail.com",
  "unstandardil@gmail.com",
]);

function notFound(): NextResponse {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

function isAuthorized(request: Request): boolean {
  if (process.env.VERCEL_ENV !== "preview") return false;
  if (process.env.VERCEL_GIT_COMMIT_REF !== TARGET_BRANCH) return false;

  const expected = process.env.UNSTANDARD_ALPHA_OPERATOR_TOKEN?.trim();
  const provided = request.headers.get("x-unstandard-alpha-operator-token")?.trim();
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return notFound();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const email = normalizeEmail(String(input.email ?? ""));
  const confirmation = String(input.confirmation ?? "");

  if (!ALLOWED_EMAILS.has(email) || confirmation !== RESET_CONFIRMATION) {
    return notFound();
  }

  const rawCode = generateInviteCode();
  const codeHash = hashInviteCode(rawCode, requireInvitePepper());
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    const deletedUsers = await tx
      .delete(users)
      .where(eq(users.email, email))
      .returning({ id: users.id });

    const deletedInvites = await tx
      .delete(alphaInvites)
      .where(eq(alphaInvites.emailNormalized, email))
      .returning({ id: alphaInvites.id });

    const [invite] = await tx
      .insert(alphaInvites)
      .values({
        emailNormalized: email,
        codeHash,
        status: "pending",
        expiresAt,
      })
      .returning({ id: alphaInvites.id });

    return {
      deletedUsers: deletedUsers.length,
      deletedInvites: deletedInvites.length,
      inviteId: invite.id,
    };
  });

  return NextResponse.json(
    {
      ok: true,
      email,
      code: rawCode,
      expiresAt: expiresAt.toISOString(),
      ...result,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
