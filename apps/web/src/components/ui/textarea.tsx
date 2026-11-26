import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClassName } from "./input";

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(controlClassName, "py-2", className)} {...props} />;
}
