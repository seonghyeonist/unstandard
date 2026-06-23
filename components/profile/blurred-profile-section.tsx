import type { ProfilePrivate, PublicProfile } from "@/types/profile";
import { Card } from "@/components/ui/card";

export function BlurredProfileSection({
  profile,
  unlocked,
  privateContent,
}: {
  profile: PublicProfile;
  unlocked: boolean;
  privateContent?: ProfilePrivate | null;
}) {
  return (
    <Card className="overflow-hidden">
      <h2 className="text-lg font-black">가려진 세계</h2>
      {unlocked && privateContent ? (
        <div className="mt-4 space-y-4">
          <p className="text-success font-semibold">이 사람의 세계가 보이기 시작해요.</p>
          <p className="leading-7 text-foreground/75">{privateContent.letter}</p>
          <div className="flex flex-wrap gap-2">
            {privateContent.smallJoys.map((joy) => (
              <span key={joy} className="rounded-full bg-success/10 px-3 py-2 text-sm text-success">
                {joy}
              </span>
            ))}
          </div>
        </div>
      ) : unlocked ? (
        <LoadingPrivateState />
      ) : (
        <div className="relative mt-4">
          <div className="space-y-3 blur-sm select-none" aria-hidden>
            {profile.locked.softFacts.map((fact) => (
              <p key={fact} className="rounded-2xl bg-background p-3 text-sm">
                {fact}
              </p>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/45 text-center backdrop-blur-[1px]">
            <p className="max-w-52 text-sm font-semibold leading-6">{profile.locked.blurredNote}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function LoadingPrivateState() {
  return <p className="mt-4 text-sm text-foreground/60">잠겨 있던 내용을 조심히 펼치는 중이에요.</p>;
}
