import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  helperText?: string;
  label?: string;
};

export function Input({
  className = "",
  error,
  helperText,
  id,
  label,
  name,
  ...props
}: InputProps) {
  const inputId = id ?? name;
  const helperId = inputId ? `${inputId}-helper` : undefined;
  const errorId = inputId ? `${inputId}-error` : undefined;
  const describedBy = error ? errorId : helperText ? helperId : undefined;

  return (
    <div className="space-y-2">
      {label ? (
        <label className="block text-sm font-semibold text-brand-ink" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        className={[
          "min-h-12 w-full rounded-2xl border bg-white px-4 text-base text-brand-ink outline-none transition",
          "placeholder:text-brand-ink/40 focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/10",
          error ? "border-brand-danger" : "border-brand-line",
          className
        ]
          .filter(Boolean)
          .join(" ")}
        id={inputId}
        name={name}
        {...props}
      />
      {helperText && !error ? (
        <p className="text-sm text-brand-ink/60" id={helperId}>
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-brand-danger" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
