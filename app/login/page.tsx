import { isDatabaseAuthConfigured, isMockAuthAllowed } from "@/lib/config/auth-mode";
import { getSocialProviderAvailability } from "@/lib/auth/social-config";
import LoginClient from "@/app/login/login-client";
import { getCanonicalAuthOrigin } from "@/lib/auth/canonical-origin";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <LoginClient
      mockAllowed={isMockAuthAllowed()}
      databaseAuthEnabled={isDatabaseAuthConfigured()}
      socialProviders={getSocialProviderAvailability()}
      canonicalOrigin={getCanonicalAuthOrigin()}
      errorCode={params.error}
    />
  );
}
