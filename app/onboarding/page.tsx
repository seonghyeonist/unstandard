import Link from "next/link";
import { AuthGuard } from "@/components/layout/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingQuestionForm } from "@/components/onboarding/onboarding-question-form";

export default function OnboardingPage() {
  return (
    <AppShell title="먼저, 당신의 한 장면" eyebrow="one question">
      <AuthGuard requireOnboarded={false}>
        <p className="mb-5 text-sm leading-6"><Link href="/profile-setup" className="underline">기본 프로필·본인인증 상태 확인</Link>에서 소개 준비 상태를 볼 수 있어요. 이미 완료한 인증은 다시 진행할 필요가 없어요.</p>
        <OnboardingQuestionForm />
      </AuthGuard>
    </AppShell>
  );
}
