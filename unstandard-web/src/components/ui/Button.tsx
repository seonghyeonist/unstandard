import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
  children: ReactNode;
  className?: string;
  href?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand-accent text-white hover:bg-[#ad392d] focus-visible:outline-brand-accent",
  secondary: "border border-brand-line bg-white text-brand-ink hover:border-brand-accent focus-visible:outline-brand-accent",
  ghost: "text-brand-ink hover:bg-brand-surface focus-visible:outline-brand-accent"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-6 text-base"
};

export function Button({
  children,
  className = "",
  disabled,
  href,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex items-center justify-center rounded-full font-semibold transition",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link aria-disabled={disabled} className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled} type={type} {...props}>
      {children}
    </button>
  );
}
