import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const mockCards = [
  {
    title: "나만 좋아하는 이상한 조합",
    body: "아직 실제 프로필 데이터가 없습니다."
  },
  {
    title: "지금 삶의 배경음악 장르",
    body: "큐레이션 알고리즘은 이후 단계에서 구현합니다."
  }
];

export default function ProfilePage() {
  return (
    <AppShell
      description="하루 소수 큐레이션과 프로필 카드가 들어갈 자리만 잡아둔 화면입니다."
      eyebrow="Profile / Curation Placeholder"
      title="오늘 당신이 발견할 사람들"
    >
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <div className="h-28 rounded-2xl bg-brand-surface" />
          <h2 className="mt-5 text-2xl font-black text-brand-ink">내 프로필</h2>
          <p className="mt-2 leading-7 text-brand-ink/70">
            사진, 인증, 자기소개 완성도, Thinker 배지는 아직 연결하지 않습니다.
            초기 화면에서는 평가감을 줄이기 위해 배지 노출도 보수적으로 둡니다.
          </p>
          <div className="mt-6">
            <Button href="/onboarding" variant="secondary">
              온보딩으로 돌아가기
            </Button>
          </div>
        </Card>

        <section className="grid gap-4">
          {mockCards.map((card) => (
            <Card key={card.title} tone="warm">
              <p className="text-sm font-bold text-brand-accent">Curation Card</p>
              <h2 className="mt-3 text-xl font-black text-brand-ink">{card.title}</h2>
              <p className="mt-3 leading-7 text-brand-ink/70">{card.body}</p>
              <div className="mt-5 rounded-2xl border border-dashed border-brand-line bg-white/70 p-4 text-sm text-brand-ink/55">
                실제 상대 카드, 블러 해제, 매칭/채팅 로직은 구현하지 않았습니다.
              </div>
            </Card>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
