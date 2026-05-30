import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function LoadingState({ label = "잠시만요. 좋은 질문을 고르는 중이에요." }: { label?: string }) {
  return <Card className="animate-pulse text-sm text-foreground/70">{label}</Card>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-foreground/70">{body}</p>
    </Card>
  );
}

export function ErrorState({ title = "잠깐 길을 잃었어요", body, onRetry }: { title?: string; body: string; onRetry?: () => void }) {
  return (
    <Card className="border-danger/30 bg-white">
      <h2 className="text-lg font-semibold text-danger">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-foreground/70">{body}</p>
      {onRetry ? <Button className="mt-4" onClick={onRetry}>다시 해볼게요</Button> : null}
    </Card>
  );
}
