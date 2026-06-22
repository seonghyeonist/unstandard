import type { HTMLAttributes, ReactNode } from "react";

type CardTone = "default" | "warm" | "accent";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: CardTone;
};

const toneClasses: Record<CardTone, string> = {
  default: "border-brand-line bg-white",
  warm: "border-brand-line bg-brand-surface",
  accent: "border-brand-accent bg-[#fff7f4]"
};

export function Card({ children, className = "", tone = "default", ...props }: CardProps) {
  return (
    <div
      className={[
        "rounded-card border p-5 shadow-soft sm:p-6",
        toneClasses[tone],
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
