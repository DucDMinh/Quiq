import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  /** Icon Tabler (không dùng emoji). */
  icon?: ReactNode;
  title: string;
  /** Câu hướng dẫn việc kế tiếp. */
  description?: string;
  /** Nút hành động chính. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      {icon ? (
        <div
          className="flex size-14 items-center justify-center rounded-full bg-brand-tint-soft text-brand"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      {description ? <p className="max-w-md text-base text-ink-secondary">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
