import "server-only";

import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import type { DbExecutor } from "@/lib/db/types";
import { users } from "@/lib/db/schema/auth";
import { legalAcceptances } from "@/lib/db/schema/legal-acceptances";
import { consumeReservedInvite } from "@/lib/auth/invite-gate";
import { ensureProfileForUser } from "@/lib/db/repositories/profile-bootstrap";
import {
  getRegistrationTicketCookieName,
  type RegistrationTicket,
} from "@/lib/auth/invite-ticket";
import { isRegistrationLegalAcceptance } from "@/lib/legal/acceptance";

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
    await db.transaction(async (tx) => {
      // Account-deletion cleanup normally removes the invite email link. A
      // failed Better Auth finalization is different: the reservation must
      // survive so the user can retry. The transaction-local flag is visible
      // only to the deletion trigger on this connection.
      await tx.execute(sql`SELECT set_config('unstandard.registration_compensation', 'on', true)`);
      await tx.delete(users).where(eq(users.id, userId));
    });
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
  legalAcceptance: RegistrationTicket["legalAcceptance"];
};

/**
 * Application-owned finalization writes in one PostgreSQL transaction.
 * Better Auth user insertion remains outside this boundary.
 */
export async function finalizeInviteRegistration(input: FinalizeInviteInput): Promise<void> {
  const db = getDb();
  const injection = process.env.UNSTANDARD_TEST_INJECT_FINALIZE_FAILURE?.trim();

  if (!isRegistrationLegalAcceptance(input.legalAcceptance)) {
    throw new InviteFinalizationError(
      "LEGAL_ACCEPTANCE_INVALID",
      "Closed Alpha legal acceptance is required",
    );
  }

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

      await tx.insert(legalAcceptances).values({
        userId: input.userId,
        adultConfirmed: input.legalAcceptance.adultConfirmed,
        termsVersion: input.legalAcceptance.termsVersion,
        safetyRulesVersion: input.legalAcceptance.safetyRulesVersion,
        acceptedAt: new Date(input.legalAcceptance.acceptedAt),
      });

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
