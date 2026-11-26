import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Quy cách chung của Input, Select, Textarea.
export const controlClassName = cn(
  "w-full min-h-(--control-height-md) rounded-sm border border-line-strong bg-surface px-3 text-base text-ink",
  "placeholder:text-ink-muted transition-colors duration-150 ease-fast",
  "enabled:hover:border-ink-muted",
  "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted",
  "aria-invalid:border-quiq-red",
);

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(controlClassName, className)} {...props} />;
}
