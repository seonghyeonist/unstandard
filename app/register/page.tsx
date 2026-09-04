import RegisterForm from "@/components/auth/register-form";
import { getSocialProviderAvailability } from "@/lib/auth/social-config";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return <RegisterForm socialProviders={getSocialProviderAvailability()} />;
}
