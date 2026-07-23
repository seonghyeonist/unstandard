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
import { accounts, sessions, users } from "@/lib/db/schema/auth";
import { answers, depthEvaluations } from "@/lib/db/schema/answers";
import { alphaInvites } from "@/lib/db/schema/invites";
import { profiles } from "@/lib/db/schema/profiles";

const TARGET_BRANCH = "cursor/neon-drizzle-better-auth-rebuild-909d";
const RESET_CONFIRMATION = "RESET_ALPHA_TEST_ACCOUNT";
const INSPECT_CONFIRMATION = "INSPECT_ALPHA_TEST_ACCOUNT";
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

  if (!ALLOWED_EMAILS.has(email)) {
    return notFound();
  }

  const db = getDb();

  if (confirmation === INSPECT_CONFIRMATION) {
    const userRows = await db
      .select({
        id: users.id,
        inviteFinalizedAt: users.inviteFinalizedAt,
      })
      .from(users)
      .where(eq(users.email, email));
    const user = userRows[0] ?? null;

    if (!user) {
      return NextResponse.json(
        {
          ok: true,
          email,
          exists: false,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const [profileRows, inviteRows, accountRows, sessionRows, answerRows, evaluationRows] =
      await Promise.all([
        db
          .select({
            id: profiles.id,
            userId: profiles.userId,
            nickname: profiles.nickname,
            onboardedAt: profiles.onboardedAt,
          })
          .from(profiles)
          .where(eq(profiles.userId, user.id)),
        db
          .select({
            id: alphaInvites.id,
            status: alphaInvites.status,
            consumedAt: alphaInvites.consumedAt,
            consumedByUserId: alphaInvites.consumedByUserId,
          })
          .from(alphaInvites)
          .where(eq(alphaInvites.emailNormalized, email)),
        db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, user.id)),
        db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, user.id)),
        db
          .select({
            id: answers.id,
            questionId: answers.questionId,
            targetProfileId: answers.targetProfileId,
          })
          .from(answers)
          .where(eq(answers.userId, user.id)),
        db
          .select({
            answerId: depthEvaluations.answerId,
            verdict: depthEvaluations.verdict,
            modelVersion: depthEvaluations.modelVersion,
          })
          .from(depthEvaluations)
          .where(eq(depthEvaluations.userId, user.id)),
      ]);

    return NextResponse.json(
      {
        ok: true,
        email,
        exists: true,
        user,
        profiles: profileRows,
        invites: inviteRows,
        accountCount: accountRows.length,
        sessionCount: sessionRows.length,
        answers: answerRows,
        evaluations: evaluationRows,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (confirmation !== RESET_CONFIRMATION) {
    return notFound();
  }

  const rawCode = generateInviteCode();
  const codeHash = hashInviteCode(rawCode, requireInvitePepper());
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
