import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Tránh lồng thẻ trong thẻ (design-spec §3).
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-md border border-line bg-surface p-5 shadow-card", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("font-display text-lg font-bold text-ink", className)} {...props} />;
}
