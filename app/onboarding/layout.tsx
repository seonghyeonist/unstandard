import { requirePageUser } from "@/lib/auth/page-guard";

export default async function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePageUser({ requireOnboarded: false });
  return children;
}
