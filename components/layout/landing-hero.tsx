import Link from "next/link";
import { AlphaCta, LandingMeasurement } from "@/components/waitlist/landing-measurement";
import { Card } from "@/components/ui/card";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";

export function LandingHero() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <LandingMeasurement />
      <nav className="mb-6 flex items-center justify-between">
        <span className="text-xl font-black tracking-[-0.04em]">unstandard</span>
        <Link href="/login" className="text-sm font-semibold text-accent">로그인</Link>
      </nav>
      <section className="flex flex-1 flex-col justify-center">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-accent">closed alpha</p>
        <h1 className="text-4xl font-black leading-[1.12] tracking-[-0.07em]">첫 대화가 달라지면, 사람도 다르게 보입니다.</h1>
        <p className="mt-4 text-base leading-7 text-foreground/75">사진보다 생각과 취향을 먼저 발견하는 데이팅 경험. 만 19세 이상을 위한 UNSTANDARD 비공개 알파에 참여해 보세요.</p>
        <AlphaCta />
        <section id="alpha-apply" tabIndex={-1} aria-labelledby="alpha-apply-title" className="mt-5 scroll-mt-5 rounded-2xl focus-visible:outline-2 focus-visible:outline-accent">
          <Card className="bg-white/55">
            <h2 id="alpha-apply-title" className="mb-3 text-lg font-bold">비공개 알파 초대 신청</h2>
            <WaitlistForm />
          </Card>
        </section>
        <Card className="mt-5 bg-white/55">
          <p className="text-sm leading-6 text-foreground/70">외모 중심의 무한 스와이프 대신, 질문과 답변으로 시작합니다. 최대 50명 규모의 비공개 알파이며, 신청 후 초대 대상자로 선정되면 이메일로 안내합니다.</p>
        </Card>
      </section>
      <footer className="pt-8 text-center text-sm text-foreground/60">
        <Link href="/privacy" className="underline underline-offset-4">개인정보 처리 안내</Link>
      </footer>
    </main>
  );
}
