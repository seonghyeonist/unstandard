import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";
import { schema } from "@/lib/db/schema";
import {
  consumeReservedInvite,
  verifyInviteReservation,
} from "@/lib/auth/invite-gate";
import {
  compensateFailedRegistration,
  isUserInviteFinalized,
  markUserInviteFinalized,
} from "@/lib/auth/invite-finalization";
import { normalizeEmail } from "@/lib/auth/invite-crypto";
import {
  getRegistrationTicketCookieName,
  verifyRegistrationTicket,
} from "@/lib/auth/invite-ticket";
import { ensureProfileForUser } from "@/lib/db/repositories/profile-bootstrap";

function getTrustedOrigins(): string[] {
  const origins = new Set<string>();
  const authUrl = process.env.BETTER_AUTH_URL?.trim();
  if (authUrl) origins.add(authUrl.replace(/\/$/, ""));
  const appUrl = process.env.UNSTANDARD_APP_URL?.trim();
  if (appUrl) origins.add(appUrl.replace(/\/$/, ""));
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
  }
  return [...origins];
}

function requireAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not configured");
  }
  return secret;
}

async function readRegistrationTicket() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(getRegistrationTicketCookieName())?.value;
  if (!raw) return null;
  return verifyRegistrationTicket(raw, requireAuthSecret());
}

const inviteGatePlugin = () => ({
  id: "invite-gate",
  hooks: {
    before: [
      {
        matcher: (context: { path?: string }) => context.path === "/sign-up/email",
        handler: createAuthMiddleware(async (ctx) => {
          const ticket = await readRegistrationTicket();
          if (!ticket) {
            throw APIError.from("FORBIDDEN", {
              code: "INVITE_REQUIRED",
              message: "Registration is invite-only",
            });
          }

          const email = normalizeEmail(String(ctx.body?.email ?? ""));
          if (email !== ticket.email) {
            throw APIError.from("FORBIDDEN", {
              code: "INVITE_REQUIRED",
              message: "Registration is invite-only",
            });
          }

          const reservationValid = await verifyInviteReservation(ticket);
          if (!reservationValid) {
            throw APIError.from("FORBIDDEN", {
              code: "INVITE_RESERVATION_INVALID",
              message: "Invite reservation is no longer valid",
            });
          }
        }),
      },
      {
        matcher: (context: { path?: string }) => context.path === "/sign-in/email",
        handler: createAuthMiddleware(async (ctx) => {
          const email = normalizeEmail(String(ctx.body?.email ?? ""));
          if (!email) return;

          const db = getDb();
          const [existingUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (existingUser && !(await isUserInviteFinalized(existingUser.id))) {
            throw APIError.from("FORBIDDEN", {
              code: "ACCOUNT_NOT_FINALIZED",
              message: "Account registration was not completed",
            });
          }
        }),
      },
    ],
  },
});

let authInstance: ReturnType<typeof betterAuth> | null = null;

export function getAuth(): ReturnType<typeof betterAuth> {
  if (authInstance) {
    return authInstance;
  }

  authInstance = betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
      usePlural: true,
    }),
    secret: requireAuthSecret(),
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: getTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
    },
    plugins: [inviteGatePlugin()],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const ticket = await readRegistrationTicket();
            if (!ticket) {
              await compensateFailedRegistration(user.id);
              throw new Error("Invite ticket missing during registration finalization");
            }

            const consumed = await consumeReservedInvite(
              ticket.inviteId,
              user.id,
              ticket.capability,
            );

            if (!consumed.ok) {
              await compensateFailedRegistration(user.id);
              throw new Error(`Invite finalization failed: ${consumed.code}`);
            }

            await markUserInviteFinalized(user.id);
            await ensureProfileForUser({ id: user.id, email: user.email });

            const cookieStore = await cookies();
            cookieStore.delete(getRegistrationTicketCookieName());
          },
        },
      },
    },
  }) as unknown as ReturnType<typeof betterAuth>;

  return authInstance;
}

export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_target, prop) {
    return Reflect.get(getAuth(), prop);
  },
});
