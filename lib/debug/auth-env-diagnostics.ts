import { isServerSupabaseConfigured } from "@/lib/config/supabase-config";
import { getReportsPersistenceAdapter } from "@/lib/config/persistence-mode";

export type AuthEnvDiagnostics = {
  ok: boolean;
  env: {
    nodeEnv: string | undefined;
    vercelEnv: string | null;
  };
  request: {
    host: string | null;
    forwardedHost: string | null;
    forwardedProto: string | null;
  };
  auth: {
    hasUnstandardSupabaseUrl: boolean;
    hasUnstandardSupabasePublishableKey: boolean;
    hasAuthCookieSecret: boolean;
    hasUnstandardAppUrl: boolean;
    isServerSupabaseConfigured: boolean;
  };
  reports: {
    hasReportsPersistenceAdapter: boolean;
    reportsPersistenceAdapterIsDisabled: boolean;
  };
};

export function buildAuthEnvDiagnostics(request: Request): AuthEnvDiagnostics {
  const hasUnstandardSupabaseUrl = Boolean(process.env.UNSTANDARD_SUPABASE_URL?.trim());
  const hasUnstandardSupabasePublishableKey = Boolean(
    process.env.UNSTANDARD_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
  const hasAuthCookieSecret = Boolean(process.env.AUTH_COOKIE_SECRET?.trim());
  const hasUnstandardAppUrl = Boolean(process.env.UNSTANDARD_APP_URL?.trim());
  const serverSupabaseConfigured = isServerSupabaseConfigured();

  const reportsAdapter = getReportsPersistenceAdapter();
  const hasReportsPersistenceAdapter = Boolean(process.env.REPORTS_PERSISTENCE_ADAPTER?.trim());
  const reportsPersistenceAdapterIsDisabled = reportsAdapter === "disabled";

  const ok =
    hasUnstandardSupabaseUrl &&
    hasUnstandardSupabasePublishableKey &&
    hasAuthCookieSecret &&
    hasUnstandardAppUrl &&
    reportsPersistenceAdapterIsDisabled &&
    serverSupabaseConfigured;

  return {
    ok,
    env: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV ?? null,
    },
    request: {
      host: request.headers.get("host"),
      forwardedHost: request.headers.get("x-forwarded-host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
    },
    auth: {
      hasUnstandardSupabaseUrl,
      hasUnstandardSupabasePublishableKey,
      hasAuthCookieSecret,
      hasUnstandardAppUrl,
      isServerSupabaseConfigured: serverSupabaseConfigured,
    },
    reports: {
      hasReportsPersistenceAdapter,
      reportsPersistenceAdapterIsDisabled,
    },
  };
}
