import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./skeleton";

export type KpiTone = "brand" | "success" | "warning" | "danger" | "info";

const TONE_BORDER: Record<KpiTone, string> = {
  brand: "border-b-brand",
  success: "border-b-quiq-green",
  warning: "border-b-quiq-amber",
  danger: "border-b-quiq-red",
  info: "border-b-quiq-sky",
};

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Dòng phụ dưới số. */
  sub?: string;
  tone?: KpiTone;
  loading?: boolean;
  className?: string;
}

export function KpiCard({ label, value, sub, tone = "brand", loading = false, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-b-(length:--lip-width) border-line bg-surface p-4 shadow-card",
        TONE_BORDER[tone],
        className,
      )}
      aria-busy={loading || undefined}
    >
      <p className="text-sm font-semibold text-ink-secondary">{label}</p>
      {loading ? (
        <div className="mt-2 flex flex-col gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      ) : (
        <>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-ink">{value}</p>
          {sub ? <p className="mt-1 text-sm text-ink-muted">{sub}</p> : null}
        </>
      )}
    </div>
  );
}
