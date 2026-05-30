import Link from "next/link";
import { Card } from "@/components/ui/card";

export function LandingHero() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <nav className="mb-12 flex items-center justify-between">
        <span className="text-xl font-black tracking-[-0.04em]">unstandard</span>
        <Link href="/login" className="text-sm font-semibold text-accent">로그인</Link>
      </nav>
      <section className="flex flex-1 flex-col justify-center">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-accent">closed alpha</p>
        <h1 className="text-5xl font-black leading-[0.95] tracking-[-0.07em]">사진보다 먼저, 한 사람의 문장.</h1>
        <p className="mt-6 text-lg leading-8 text-foreground/75">스와이프 대신 질문 하나로 시작해요. 짧고 솔직한 답이 어울리면, 가려진 세계가 조금 열립니다.</p>
        <Link href="/login" className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#ad392c]">알파 들어가기</Link>
        <Card className="mt-8 bg-white/55">
          <p className="text-sm leading-6 text-foreground/70">외모 점수도, 긴 검사도 없어요. 오늘은 그저 “나답게 말할 수 있는 사람”을 찾아봅니다.</p>
        </Card>
      </section>
    </main>
  );
}
