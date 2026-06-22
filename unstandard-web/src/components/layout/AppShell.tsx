import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "랜딩" },
  { href: "/onboarding", label: "온보딩" },
  { href: "/questions", label: "질문" },
  { href: "/profile", label: "큐레이션" }
];

type AppShellProps = {
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  title?: string;
};

export function AppShell({ children, description, eyebrow, title }: AppShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-panel border border-brand-line bg-white/80 p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <Link className="text-lg font-black tracking-tight text-brand-accent" href="/">
          UNSTANDARD
        </Link>
        <nav aria-label="주요 화면" className="flex flex-wrap gap-2 text-sm font-semibold text-brand-ink/70">
          {navItems.map((item) => (
            <Link
              className="rounded-full px-3 py-2 transition hover:bg-brand-surface hover:text-brand-ink"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {title ? (
        <section className="py-8 sm:py-12">
          {eyebrow ? <p className="text-sm font-bold text-brand-accent">{eyebrow}</p> : null}
          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-brand-ink sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-2xl text-base leading-7 text-brand-ink/70 sm:text-lg">
              {description}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="flex-1 pb-10">{children}</div>
    </main>
  );
}
