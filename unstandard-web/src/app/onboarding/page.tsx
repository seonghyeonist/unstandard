import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function OnboardingPage() {
  return (
    <AppShell
      description="가입, 인증, 저장 로직 없이 닉네임과 첫 질문 경험의 형태만 확인하는 화면입니다."
      eyebrow="Onboarding Placeholder"
      title="지금 딱 맞는 질문 하나만"
    >
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="text-xl font-black text-brand-ink">기본 정보</h2>
          <p className="mt-2 text-sm leading-6 text-brand-ink/65">
            실제 프로필 생성은 Auth/DB 연결 이후 구현합니다.
          </p>
          <div className="mt-5 space-y-4">
            <Input label="닉네임" name="nickname" placeholder="예: 도란도란" />
            <Input label="한 줄 소개" name="headline" placeholder="예: 대화가 길어지는 사람" />
          </div>
        </Card>

        <Card tone="warm">
          <p className="text-sm font-bold text-brand-accent">첫 질문</p>
          <h2 className="mt-3 text-2xl font-black text-brand-ink">평생 배달 음식 하나만 먹어야 한다면?</h2>
          <p className="mt-4 leading-7 text-brand-ink/70">
            30초 안에 답할 수 있고, 정답은 없고, 첫 줄에서 살짝 웃길 수 있는 질문부터 시작합니다.
          </p>
          <div className="mt-6 rounded-2xl border border-brand-line bg-white p-4 text-brand-ink/45">
            답변 입력 영역은 질문 답변 화면에서 연결합니다.
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button href="/questions">질문 답변 화면으로</Button>
            <Button disabled variant="secondary">
              저장은 이후 구현
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
