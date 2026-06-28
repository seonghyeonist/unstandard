import { getSupabaseOAuthProvider } from "@/lib/config/supabase-config";
import { isMockAuthAllowed, isSupabaseAuthEnabled } from "@/lib/config/auth-mode";
import LoginClient from "@/app/login/login-client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <LoginClient
      mockAllowed={isMockAuthAllowed()}
      supabaseEnabled={isSupabaseAuthEnabled()}
      oauthProvider={getSupabaseOAuthProvider()}
      errorCode={params.error}
    />
  );
}
