import Link from "next/link";
import { AuthGuard } from "@/components/layout/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingQuestionForm } from "@/components/onboarding/onboarding-question-form";

export default function OnboardingPage() {
  return (
    <AppShell title="먼저, 당신의 한 장면" eyebrow="one question">
      <AuthGuard requireOnboarded={false}>
        <p className="mb-5 text-sm leading-6">상대 소개 전 <Link href="/profile-setup" className="underline">기본 프로필·본인인증</Link>도 완료해야 해요.</p>
        <OnboardingQuestionForm />
      </AuthGuard>
    </AppShell>
  );
}
