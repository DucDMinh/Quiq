import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Bảng nằm trong khung cuộn riêng: cuộn ngang không làm cả trang cuộn.
 * Muốn header cố định khi cuộn dọc, đặt chiều cao tối đa qua className (ví dụ `max-h-96`).
 */
export function Table({
  className,
  wrapperClassName,
  ...props
}: ComponentProps<"table"> & { wrapperClassName?: string }) {
  return (
    <div
      className={cn("overflow-auto rounded-md border border-line bg-surface", wrapperClassName)}
      // Khung cuộn có tên thì là vùng focus được bằng bàn phím để cuộn bằng phím mũi tên.
      {...(props["aria-label"] ? { tabIndex: 0, role: "region", "aria-label": props["aria-label"] } : {})}
    >
      <table className={cn("w-full border-collapse text-left text-base", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("sticky top-0 z-10 bg-subtle", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&>tr:last-child>td]:border-b-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors duration-150 hover:bg-brand-tint-soft", className)} {...props} />;
}

export function TableHead({
  className,
  align = "left",
  ...props
}: ComponentProps<"th"> & { align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line-strong px-4 py-2.5 text-sm font-bold whitespace-nowrap text-ink-secondary",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  align = "left",
  ...props
}: ComponentProps<"td"> & { align?: "left" | "right" }) {
  return (
    <td
      className={cn(
        "border-b border-line px-4 py-3 align-middle text-ink",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}
