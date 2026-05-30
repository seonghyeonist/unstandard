import type { Profile } from "@/types/profile";
import { Card } from "@/components/ui/card";

export function BlurredProfileSection({ profile, unlocked }: { profile: Profile; unlocked: boolean }) {
  return (
    <Card className="overflow-hidden">
      <h2 className="text-lg font-black">가려진 세계</h2>
      {unlocked ? (
        <div className="mt-4 space-y-4">
          <p className="text-success font-semibold">이 사람의 세계가 보이기 시작해요.</p>
          <p className="leading-7 text-foreground/75">{profile.unlocked.letter}</p>
          <div className="flex flex-wrap gap-2">
            {profile.unlocked.smallJoys.map((joy) => <span key={joy} className="rounded-full bg-success/10 px-3 py-2 text-sm text-success">{joy}</span>)}
          </div>
        </div>
      ) : (
        <div className="relative mt-4">
          <div className="space-y-3 blur-sm select-none" aria-hidden>
            {profile.locked.softFacts.map((fact) => <p key={fact} className="rounded-2xl bg-background p-3 text-sm">{fact}</p>)}
          </div>
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/45 text-center backdrop-blur-[1px]">
            <p className="max-w-52 text-sm font-semibold leading-6">{profile.locked.blurredNote}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
