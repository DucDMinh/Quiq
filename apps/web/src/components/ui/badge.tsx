import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-badge font-bold leading-tight whitespace-nowrap",
  {
    variants: {
      tone: {
        brand: "border-brand-border bg-brand-tint text-brand-dark",
        success: "border-success-border bg-success-bg text-success-text",
        warning: "border-warning-border bg-warning-bg text-warning-text",
        danger: "border-danger-border bg-danger-bg text-danger-text",
        info: "border-info-border bg-info-bg text-info-text",
        neutral: "border-neutral-border bg-neutral-bg text-neutral-text",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export interface BadgeProps extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

// Luôn có chữ: màu chỉ hỗ trợ, không phải kênh duy nhất.
export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
