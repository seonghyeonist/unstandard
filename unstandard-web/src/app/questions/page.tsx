import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function QuestionsPage() {
  return (
    <AppShell
      description="답변 저장, Depth Score, AI 판정 없이 질문 응답 UI의 골격만 둡니다."
      eyebrow="Question Placeholder"
      title="오늘의 질문"
    >
      <div className="mx-auto max-w-2xl">
        <Card tone="accent">
          <p className="text-sm font-bold text-brand-accent">L2 · 마이너 취향</p>
          <h2 className="mt-3 text-2xl font-black leading-tight text-brand-ink">
            남들은 싫어하는데 나만 좋아하는 조합은?
          </h2>
          <p className="mt-4 leading-7 text-brand-ink/70">
            지금 단계에서는 입력값을 평가하지 않습니다. 실제 판정과 블러 해제는 이후 Depth Score mock 단계에서 분리 구현합니다.
          </p>
          <label className="mt-6 block text-sm font-semibold text-brand-ink" htmlFor="answer">
            답변
          </label>
          <textarea
            className="mt-2 min-h-40 w-full resize-y rounded-2xl border border-brand-line bg-white px-4 py-3 text-base text-brand-ink outline-none transition placeholder:text-brand-ink/40 focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/10"
            id="answer"
            name="answer"
            placeholder="예: 비 오는 날 편의점 앞에서 먹는 뜨거운 어묵이요. 이상하게 마음이 정리됩니다."
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button disabled>답변 제출</Button>
            <Button href="/profile" variant="secondary">
              큐레이션 미리보기
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
