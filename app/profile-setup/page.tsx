import { AppShell } from "@/components/layout/app-shell";
import { ProfileSetup } from "@/components/profile/profile-basics-form";
import { requirePageUser } from "@/lib/auth/page-guard";
export default async function ProfileSetupPage({ searchParams }: { searchParams: Promise<{ identityRequest?: string }> }) {
  await requirePageUser({ requireOnboarded: false });
  const params = await searchParams;
  return <AppShell title="소개를 위한 기본 정보" eyebrow="profile setup"><ProfileSetup identityRequest={params.identityRequest} /></AppShell>;
}
