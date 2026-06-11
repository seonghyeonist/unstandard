import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[2rem] border border-line bg-white/70 p-5 shadow-sm", className)} {...props} />;
}
