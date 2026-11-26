import type { ReactNode } from "react";
import { Alert, Button, Card, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Portal shell của học sinh: nền phẳng, nội dung căn giữa (design-spec §3). */
export function PortalFrame({
  width = "narrow",
  children,
}: {
  width?: "narrow" | "result";
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-portal px-8 py-12">
      <div
        className={cn(
          "mx-auto flex flex-col gap-6",
          width === "result" ? "max-w-(--layout-result-max)" : "max-w-[780px]",
        )}
      >
        <p className="font-display text-2xl font-extrabold text-brand">Quiq</p>
        {children}
      </div>
    </main>
  );
}

export function CardSkeleton() {
  return (
    <Card className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-12 w-56" />
    </Card>
  );
}

export interface LoadErrorProps {
  message: string;
  onRetry?: () => void;
  /** Phiên đã hết: thay "Thử lại" bằng liên kết về trang nhập mã. */
  enterHref?: string;
}

export function LoadError({ message, onRetry, enterHref }: LoadErrorProps) {
  const action = enterHref ? (
    <a href={enterHref} className="font-bold underline">
      Nhập lại mã
    </a>
  ) : onRetry ? (
    <Button size="sm" variant="secondary" onClick={onRetry}>
      Thử lại
    </Button>
  ) : null;
  return (
    <Alert tone="danger" action={action}>
      {message}
    </Alert>
  );
}
