"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { usePortalContainer } from "@/components/portal-container";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const SIZE_CLASS = {
  sm: "w-[28rem]",
  md: "w-[36rem]",
  lg: "w-[48rem]",
} as const;

export interface DialogContentProps {
  title: string;
  description?: string;
  /** Chân hộp thoại, thường là nút Hủy và Xác nhận. */
  footer?: ReactNode;
  size?: keyof typeof SIZE_CLASS;
  children?: ReactNode;
  className?: string;
}

// Radix lo bẫy focus, đóng bằng Esc, trả focus về nút mở và aria-modal.
export function DialogContent({
  title,
  description,
  footer,
  size = "md",
  children,
  className,
}: DialogContentProps) {
  const container = usePortalContainer();
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-brand-dark/60" />
      <DialogPrimitive.Content
        // Không có mô tả thì tắt liên kết mô tả để Radix khỏi cảnh báo thiếu Description.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-4rem)] max-w-[calc(100vw-4rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-surface p-6 shadow-lg",
          SIZE_CLASS[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <DialogPrimitive.Title className="font-display text-xl font-extrabold text-ink">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <IconButton label="Đóng" size="sm" variant="secondary">
              <IconX size={18} aria-hidden="true" />
            </IconButton>
          </DialogPrimitive.Close>
        </div>
        {description ? (
          <DialogPrimitive.Description className="mt-2 text-base text-ink-secondary">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
