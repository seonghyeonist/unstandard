import { isDatabaseAuthConfigured } from "@/lib/config/runtime-mode";
import { getReportsPersistenceAdapter } from "@/lib/config/persistence-mode";

export type AuthEnvDiagnostics = {
  ok: boolean;
  env: {
    nodeEnv: string | undefined;
    vercelEnv: string | null;
    runtimeMode: string | undefined;
    databaseEnv: string | undefined;
  };
  request: {
    host: string | null;
    forwardedHost: string | null;
    forwardedProto: string | null;
  };
  auth: {
    hasDatabaseUrl: boolean;
    hasBetterAuthSecret: boolean;
    hasBetterAuthUrl: boolean;
    hasAuthCookieSecret: boolean;
    hasUnstandardAppUrl: boolean;
    isDatabaseAuthConfigured: boolean;
  };
  reports: {
    reportsPersistenceAdapter: string;
  };
};

export function buildAuthEnvDiagnostics(request: Request): AuthEnvDiagnostics {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasBetterAuthSecret = Boolean(process.env.BETTER_AUTH_SECRET?.trim());
  const hasBetterAuthUrl = Boolean(process.env.BETTER_AUTH_URL?.trim());
  const hasAuthCookieSecret = Boolean(process.env.AUTH_COOKIE_SECRET?.trim());
  const hasUnstandardAppUrl = Boolean(process.env.UNSTANDARD_APP_URL?.trim());
  const databaseAuthConfigured = isDatabaseAuthConfigured();

  const ok =
    hasDatabaseUrl &&
    hasBetterAuthSecret &&
    hasBetterAuthUrl &&
    hasAuthCookieSecret &&
    hasUnstandardAppUrl &&
    databaseAuthConfigured;

  return {
    ok,
    env: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      runtimeMode: process.env.UNSTANDARD_RUNTIME_MODE,
      databaseEnv: process.env.DATABASE_ENV,
    },
    request: {
      host: request.headers.get("host"),
      forwardedHost: request.headers.get("x-forwarded-host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
    },
    auth: {
      hasDatabaseUrl,
      hasBetterAuthSecret,
      hasBetterAuthUrl,
      hasAuthCookieSecret,
      hasUnstandardAppUrl,
      isDatabaseAuthConfigured: databaseAuthConfigured,
    },
    reports: {
      reportsPersistenceAdapter: getReportsPersistenceAdapter(),
    },
  };
}
