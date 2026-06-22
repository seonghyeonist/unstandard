import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const problems = ["외모 스와이프 피로", "공허한 첫 인사", "의미 없는 매칭 반복"];
const steps = ["가입", "질문 하나에 답하기", "상대의 일부 열어보기", "대화 시작"];

export default function LandingPage() {
  return (
    <AppShell
      description="Unstandard는 외모 스와이프의 속도는 줄이고, 첫 대화의 밀도는 높이는 질문 기반 소개 웹앱입니다."
      eyebrow="Closed Alpha MVP"
      title="첫 대화가 달라지면, 사람도 다르게 보인다."
    >
      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <Card tone="warm">
          <p className="text-sm font-bold text-brand-accent">왜 지금인가</p>
          <h2 className="mt-3 text-2xl font-black text-brand-ink">안녕하세요 릴레이 말고, 질문으로 시작합니다.</h2>
          <p className="mt-4 leading-7 text-brand-ink/70">
            길게 자기소개를 쓰게 만들지는 않습니다. 대신 오늘 답할 수 있는 질문 하나로,
            상대의 세계가 조금 보이는 순간까지의 마찰을 줄입니다.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button href="/onboarding" size="lg">
              온보딩 미리보기
            </Button>
            <Button href="/questions" size="lg" variant="secondary">
              질문 화면 보기
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-black text-brand-ink">알파 신청 Placeholder</h2>
          <p className="mt-2 text-sm leading-6 text-brand-ink/65">
            실제 waitlist 저장은 이후 DB 연결 단계에서 붙입니다. 지금은 UI 골격만 둡니다.
          </p>
          <div className="mt-5 space-y-4">
            <Input
              disabled
              helperText="아직 저장되지 않습니다. Auth/DB 연결 전까지 비활성 상태입니다."
              label="이메일"
              name="email"
              placeholder="alpha@unstandard.kr"
              type="email"
            />
            <Button disabled className="w-full">
              클로즈드 알파 신청하기
            </Button>
          </div>
        </Card>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {problems.map((problem) => (
          <Card className="shadow-none" key={problem}>
            <p className="text-sm font-bold text-brand-accent">Problem</p>
            <h3 className="mt-2 text-lg font-black text-brand-ink">{problem}</h3>
          </Card>
        ))}
      </section>

      <section className="mt-6">
        <Card>
          <h2 className="text-xl font-black text-brand-ink">작동 흐름</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-4">
            {steps.map((step, index) => (
              <li className="rounded-2xl border border-brand-line bg-brand-surface p-4" key={step}>
                <span className="text-sm font-black text-brand-accent">0{index + 1}</span>
                <p className="mt-2 font-bold text-brand-ink">{step}</p>
              </li>
            ))}
          </ol>
        </Card>
      </section>
    </AppShell>
  );
}
