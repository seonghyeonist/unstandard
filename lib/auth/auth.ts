import "server-only";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";
import { schema } from "@/lib/db/schema";
import { verifyInviteReservation } from "@/lib/auth/invite-gate";
import {
  compensateFailedRegistration,
  clearRegistrationTicketCookie,
  finalizeInviteRegistration,
  isUserInviteFinalized,
} from "@/lib/auth/invite-finalization";
import { normalizeEmail } from "@/lib/auth/invite-crypto";
import {
  getRegistrationTicketCookieName,
  verifyRegistrationTicket,
} from "@/lib/auth/invite-ticket";
import { oauthInviteRegistrationAllowed } from "@/lib/auth/oauth-invite";
import { getSocialProviderAvailability } from "@/lib/auth/social-config";
import { readSmallJson } from "@/lib/http/profile-request";

function getTrustedOrigins(): string[] {
  const origins = new Set<string>();
  const authUrl = process.env.BETTER_AUTH_URL?.trim();
  if (authUrl) origins.add(authUrl.replace(/\/$/, ""));
  const appUrl = process.env.UNSTANDARD_APP_URL?.trim();
  if (appUrl) origins.add(appUrl.replace(/\/$/, ""));
  for (const hostname of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ]) {
    const value = hostname?.trim();
    if (!value) continue;

    const origin = value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `https://${value}`;

    origins.add(origin.replace(/\/$/, ""));
  }

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

function socialProviders(): NonNullable<BetterAuthOptions["socialProviders"]> {
  const availability = getSocialProviderAvailability();
  const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return {
    ...(availability.google && googleId && googleSecret ? {
      google: {
        clientId: googleId,
        clientSecret: googleSecret,
        disableImplicitSignUp: true,
        mapProfileToUser: (profile) => ({
          // OAuth display names are not application profile names.
          name: "Member",
          image: undefined,
          emailVerified: profile.email_verified === true,
        }),
      },
    } : {}),
  };
}

const naverProfileSchema = z.object({
  response: z.object({
    id: z.string().trim().min(1).max(256),
    email: z.string().trim().email().max(320),
  }).passthrough(),
}).passthrough();

function naverOAuthConfig() {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret || /[\r\n]/.test(clientId) || /[\r\n]/.test(clientSecret)) return [];

  return [{
    providerId: "naver",
    authorizationUrl: "https://nid.naver.com/oauth2.0/authorize",
    tokenUrl: "https://nid.naver.com/oauth2.0/token",
    userInfoUrl: "https://openapi.naver.com/v1/nid/me",
    clientId,
    clientSecret,
    // Naver's login API treats profile permissions as an app-console setting;
    // do not request unrelated profile fields from the authorization screen.
    scopes: [],
    disableImplicitSignUp: true,
    getUserInfo: async (tokens: { accessToken?: string }) => {
      if (!tokens.accessToken) return null;
      try {
        const response = await fetch("https://openapi.naver.com/v1/nid/me", {
          method: "GET",
          cache: "no-store",
          redirect: "error",
          headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: "application/json" },
        });
        if (!response.ok) {
          await response.body?.cancel();
          return null;
        }
        const parsed = naverProfileSchema.safeParse(await readSmallJson(response, 32 * 1024));
        if (!parsed.success) return null;
        return {
          id: parsed.data.response.id,
          name: "Member",
          email: parsed.data.response.email,
          emailVerified: false,
        };
      } catch {
        return null;
      }
    },
    mapProfileToUser: (profile: Record<string, unknown>) => ({
      // Naver's authenticated email is used only for the invite match;
      // no Naver name, phone or profile image enters the local user record.
      name: "Member",
      image: undefined,
      email: typeof profile.email === "string" ? profile.email.trim() : undefined,
      emailVerified: false,
    }),
  }];
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

function oauthCallbackProvider(context: { path?: string; params?: Record<string, unknown> } | null): "google" | "naver" | null {
  const path = context?.path ?? "";
  const parameterProvider = typeof context?.params?.id === "string"
    ? context.params.id
    : typeof context?.params?.providerId === "string" ? context.params.providerId : "";
  const pathProvider = /^\/(?:oauth2\/)?callback\/(google|naver)$/.exec(path)?.[1] ?? "";
  if (parameterProvider && parameterProvider !== "google" && parameterProvider !== "naver") {
    throw APIError.from("FORBIDDEN", {
      code: "INVITE_REQUIRED",
      message: "Registration is invite-only",
    });
  }
  if (parameterProvider && pathProvider && parameterProvider !== pathProvider) {
    throw APIError.from("FORBIDDEN", {
      code: "INVITE_REQUIRED",
      message: "Registration is invite-only",
    });
  }
  const provider = parameterProvider || pathProvider;
  if (provider === "google" || provider === "naver") return provider;
  if (path === "/callback/:id" || path === "/oauth2/callback/:providerId" || path.startsWith("/callback/") || path.startsWith("/oauth2/callback/")) {
    throw APIError.from("FORBIDDEN", {
      code: "INVITE_REQUIRED",
      message: "Registration is invite-only",
    });
  }
  return null;
}

async function requireOAuthInvite(context: { path?: string; params?: Record<string, unknown> } | null, email: string) {
  const path = context?.path ?? "";
  const isEmailRegistration = path === "/sign-up/email";
  const isAllowedOAuthRegistration = Boolean(oauthCallbackProvider(context));
  if (!isEmailRegistration && !isAllowedOAuthRegistration) {
    throw APIError.from("FORBIDDEN", {
      code: "INVITE_REQUIRED",
      message: "Registration is invite-only",
    });
  }
  const ticket = await readRegistrationTicket();
  const reservationValid = ticket ? await verifyInviteReservation(ticket) : false;
  if (!oauthInviteRegistrationAllowed({
    oauthEmail: email,
    inviteEmail: ticket?.email,
    reservationValid,
  })) {
    throw APIError.from("FORBIDDEN", {
      code: "INVITE_REQUIRED",
      message: "Registration is invite-only",
    });
  }
}

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
    socialProviders: socialProviders(),
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
        "/delete-user": { window: 3_600, max: 3 },
      },
    },
    advanced: {
      ipAddress: {
        // Vercel overwrites this header with the public client IP.
        ipAddressHeaders: ["x-forwarded-for"],
      },
    },
    plugins: [genericOAuth({ config: naverOAuthConfig() }), inviteGatePlugin(), nextCookies()],
    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => {
            await requireOAuthInvite(context as { path?: string; params?: Record<string, unknown> } | null, user.email);
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
