import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { Match } from "@/types/match";

export function MatchCard({ match }: { match: Match }) {
  return (
    <Link href={`/app/chat/${match.id}`}>
      <Card>
        <h2 className="text-xl font-black tracking-[-0.04em]">{match.nickname}</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/65">{match.lastMessage ?? "이제 첫 문장을 건넬 수 있어요."}</p>
      </Card>
    </Link>
  );
}
