import type { Profile } from "@/types/profile";

export function ProfileHeader({ profile }: { profile: Profile }) {
  return (
    <section className="rounded-[2rem] bg-[#202433] p-6 text-white">
      <p className="text-sm text-white/60">{profile.city}에서 온 질문</p>
      <h1 className="mt-2 text-4xl font-black tracking-[-0.06em]">{profile.nickname}</h1>
      <p className="mt-4 text-lg leading-8 text-white/80">{profile.teaser}</p>
    </section>
  );
}
