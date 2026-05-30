import { AuthGuard } from "@/components/layout/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingQuestionForm } from "@/components/onboarding/onboarding-question-form";

export default function OnboardingPage() {
  return (
    <AppShell title="먼저, 당신의 한 장면" eyebrow="one question">
      <AuthGuard requireOnboarded={false}>
        <OnboardingQuestionForm />
      </AuthGuard>
    </AppShell>
  );
}
