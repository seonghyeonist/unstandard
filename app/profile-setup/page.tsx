import { AppShell } from "@/components/layout/app-shell";
import { ProfileSetup } from "@/components/profile/profile-basics-form";
import { requirePageUser } from "@/lib/auth/page-guard";
export default async function ProfileSetupPage() {
  await requirePageUser({ requireOnboarded: false });
  return <AppShell title="소개를 위한 기본 정보" eyebrow="profile setup"><ProfileSetup /></AppShell>;
}
