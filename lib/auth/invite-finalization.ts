import "server-only";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import type { DbExecutor } from "@/lib/db/types";
import { users } from "@/lib/db/schema/auth";
import { consumeReservedInvite } from "@/lib/auth/invite-gate";
import { ensureProfileForUser } from "@/lib/db/repositories/profile-bootstrap";
import { getRegistrationTicketCookieName } from "@/lib/auth/invite-ticket";

export class InviteFinalizationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "InviteFinalizationError";
    this.code = code;
  }
}

function logSanitizedFinalizationFailure(code: string): void {
  console.error({
    action: "invite_finalization_failed",
    code,
  });
}

export async function isUserInviteFinalized(
  userId: string,
  db: DbExecutor = getDb(),
): Promise<boolean> {
  const [row] = await db
    .select({ inviteFinalizedAt: users.inviteFinalizedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return Boolean(row?.inviteFinalizedAt);
}

export async function markUserInviteFinalized(
  userId: string,
  db: DbExecutor = getDb(),
): Promise<void> {
  const updated = await db
    .update(users)
    .set({ inviteFinalizedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (updated.length !== 1) {
    throw new InviteFinalizationError(
      "FINALIZE_USER_UPDATE_FAILED",
      "Expected exactly one user row to be finalized",
    );
  }
}

export async function compensateFailedRegistration(userId: string): Promise<void> {
  const db = getDb();
  try {
    await db.delete(users).where(eq(users.id, userId));
  } catch {
    logSanitizedFinalizationFailure("COMPENSATION_DELETE_FAILED");
  }
}

export async function clearRegistrationTicketCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(getRegistrationTicketCookieName());
  } catch {
    // Cookie clearing is best-effort on terminal failure paths.
  }
}

type FinalizeInviteInput = {
  inviteId: string;
  userId: string;
  reservationCapability: string;
  email?: string | null;
};

/**
 * Application-owned finalization writes in one PostgreSQL transaction.
 * Better Auth user insertion remains outside this boundary.
 */
export async function finalizeInviteRegistration(input: FinalizeInviteInput): Promise<void> {
  const db = getDb();
  const injection = process.env.UNSTANDARD_TEST_INJECT_FINALIZE_FAILURE?.trim();

  try {
    await db.transaction(async (tx) => {
      if (injection === "consume") {
        throw new InviteFinalizationError("INJECTED_CONSUME_FAILURE", "Injected consume failure");
      }

      const consumed = await consumeReservedInvite(
        input.inviteId,
        input.userId,
        input.reservationCapability,
        tx,
      );
      if (!consumed.ok) {
        throw new InviteFinalizationError(consumed.code, "Invite consume failed");
      }

      if (injection === "finalize") {
        throw new InviteFinalizationError("INJECTED_FINALIZE_FAILURE", "Injected finalize failure");
      }

      await markUserInviteFinalized(input.userId, tx);

      if (injection === "profile") {
        throw new InviteFinalizationError("INJECTED_PROFILE_FAILURE", "Injected profile failure");
      }

      await ensureProfileForUser({ id: input.userId, email: input.email }, tx);
    });

    await clearRegistrationTicketCookie();
  } catch (error) {
    await compensateFailedRegistration(input.userId);
    await clearRegistrationTicketCookie();
    logSanitizedFinalizationFailure(
      error instanceof InviteFinalizationError ? error.code : "FINALIZE_TRANSACTION_FAILED",
    );
    throw error;
  }
}
