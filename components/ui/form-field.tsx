import { cn } from "@/lib/utils";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-line bg-white px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10",
        props.className,
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-36 w-full resize-none rounded-3xl border border-line bg-white px-4 py-4 text-base outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10",
        props.className,
      )}
    />
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-2 text-sm text-danger">{children}</p>;
}
