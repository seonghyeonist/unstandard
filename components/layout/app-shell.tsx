import Link from "next/link";

export function AppShell({ children, title, eyebrow }: { children: React.ReactNode; title?: string; eyebrow?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/app/home" className="text-lg font-black tracking-[-0.04em]">unstandard</Link>
        <Link href="/app/settings" className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-foreground/70">설정</Link>
      </header>
      {eyebrow || title ? (
        <section className="mb-5">
          {eyebrow ? <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</p> : null}
          {title ? <h1 className="text-3xl font-black tracking-[-0.05em]">{title}</h1> : null}
        </section>
      ) : null}
      <div className="flex-1">{children}</div>
    </main>
  );
}
