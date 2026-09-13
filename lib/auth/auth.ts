import "server-only";

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { users } from "@/lib/db/schema/auth";
import { isEmailVerificationTicketUsable } from "@/lib/auth/email-verification";
import { normalizeEmail } from "@/lib/auth/invite-crypto";
import { isAcceptableNewPassword } from "@/lib/auth/password-policy";
import { verifyInviteReservation } from "@/lib/auth/invite-gate";
import {
  compensateFailedRegistration,
  clearRegistrationTicketCookie,
  finalizeInviteRegistration,
  isUserInviteFinalized,
} from "@/lib/auth/invite-finalization";
import {
  getRegistrationTicketCookieName,
  verifyRegistrationTicket,
} from "@/lib/auth/invite-ticket";
import { sendPasswordResetEmail } from "@/lib/email/transactional";
import { getCanonicalAuthOrigin } from "@/lib/auth/canonical-origin";

function getTrustedOrigins(): string[] {
  return [getCanonicalAuthOrigin()];
}

function requireAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not configured");
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
        matcher: (context: { path?: string }) => context.path === "/sign-up/email" || context.path === "/reset-password",
        handler: createAuthMiddleware(async (ctx) => {
          const candidate = ctx.path === "/reset-password"
            ? ctx.body?.newPassword
            : ctx.body?.password;
          if (!isAcceptableNewPassword(candidate)) {
            throw APIError.from("BAD_REQUEST", {
              code: "PASSWORD_TOO_WEAK",
              message: "Password does not meet the minimum security requirements",
            });
          }
        }),
      },
      {
        matcher: (context: { path?: string }) => context.path === "/sign-in/email",
        handler: createAuthMiddleware(async (ctx) => {
          const email = normalizeEmail(String(ctx.body?.email ?? ""));
          if (!email) return;

          const [existingUser] = await getDb()
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
      {
        matcher: (context: { path?: string }) => context.path === "/delete-user",
        handler: createAuthMiddleware(async (ctx) => {
          const password = String(ctx.body?.password ?? "");
          if (password.length < 10) {
            throw APIError.from("BAD_REQUEST", {
              code: "PASSWORD_REQUIRED",
              message: "Current password is required",
            });
          }
        }),
      },
    ],
  },
});

async function requireInviteRegistration(email: string) {
  const ticket = await readRegistrationTicket();
  const proofUsable = ticket
    ? await isEmailVerificationTicketUsable({
        inviteId: ticket.inviteId,
        email: ticket.email,
        challengeId: ticket.emailVerificationId,
        exp: ticket.exp,
      })
    : false;
  const reservationValid = ticket ? await verifyInviteReservation(ticket) : false;

  if (
    !ticket ||
    !proofUsable ||
    !reservationValid ||
    normalizeEmail(email) !== ticket.email
  ) {
    throw APIError.from("FORBIDDEN", {
      code: "INVITE_REQUIRED",
      message: "A verified personal invitation is required to create an account",
    });
  }
}

let authInstance: ReturnType<typeof betterAuth> | null = null;

export function getAuth(): ReturnType<typeof betterAuth> {
  if (authInstance) return authInstance;

  authInstance = betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
      usePlural: true,
      // Better Auth's user + credential-account creation must share one
      // PostgreSQL transaction. App-owned invite proof/finalization follows
      // in the post-commit hook with compensation on failure.
      transaction: true,
    }),
    secret: requireAuthSecret(),
    baseURL: getCanonicalAuthOrigin(),
    trustedOrigins: getTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 15 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        try {
          await sendPasswordResetEmail({ to: user.email, url });
        } catch {
          // Keep reset requests enumeration-safe. Operational logs carry only
          // a stable failure code; the address and token never enter logs.
          console.error({ action: "password_reset_delivery_failed", code: "EMAIL_DELIVERY_FAILED" });
        }
      },
    },
    account: {
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
        allowDifferentEmails: false,
        updateUserInfoOnLink: false,
      },
    },
    user: {
      deleteUser: {
        enabled: true,
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 10,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 5 },
        "/reset-password": { window: 60, max: 10 },
        "/delete-user": { window: 3_600, max: 3 },
      },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
      },
    },
    plugins: [inviteGatePlugin(), nextCookies()],
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            await requireInviteRegistration(user.email);
            // The custom pre-account challenge is the email ownership proof.
            // Marking this true prevents Better Auth's built-in post-account
            // verification flow from creating a second, weaker path.
            return { data: { emailVerified: true } };
          },
          after: async (user) => {
            const ticket = await readRegistrationTicket();
            if (!ticket) {
              await compensateFailedRegistration(user.id);
              await clearRegistrationTicketCookie();
              throw new Error("Invite ticket missing during registration finalization");
            }

            try {
              await finalizeInviteRegistration({
                inviteId: ticket.inviteId,
                userId: user.id,
                reservationCapability: ticket.capability,
                emailVerificationId: ticket.emailVerificationId,
                email: user.email,
                legalAcceptance: ticket.legalAcceptance,
              });
            } catch {
              throw new Error("Invite registration finalization failed");
            }
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
