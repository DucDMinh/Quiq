import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Khối giữ chỗ đúng kích thước nội dung thật; truyền kích thước qua className. Không nhấp nháy khi giảm chuyển động. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-sm bg-subtle motion-reduce:animate-none", className)}
      {...props}
    />
  );
}
