import ResetPasswordForm from "@/components/auth/reset-password-form";
import { getCanonicalAuthOrigin } from "@/lib/auth/canonical-origin";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordForm canonicalOrigin={getCanonicalAuthOrigin()} initialToken={params.token ?? null} />;
}
