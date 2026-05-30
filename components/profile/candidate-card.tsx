import Link from "next/link";
import type { Candidate } from "@/types/profile";
import { Card } from "@/components/ui/card";

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <Link href={`/app/profile/${candidate.id}`}>
      <Card className="transition hover:-translate-y-0.5 hover:border-accent/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.04em]">{candidate.nickname}</h2>
            <p className="mt-1 text-sm text-foreground/60">{candidate.age} · {candidate.city}</p>
          </div>
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">질문 대기중</span>
        </div>
        <p className="mt-5 text-base leading-7">“{candidate.teaser}”</p>
        <p className="mt-4 rounded-2xl bg-background p-4 text-sm leading-6 text-foreground/70">{candidate.question}</p>
      </Card>
    </Link>
  );
}
