"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { usePortalContainer } from "@/components/portal-container";
import { Alert, Button, Dialog, DialogClose, DialogContent } from "@/components/ui";

export interface SubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unansweredCount: number;
  submitting: boolean;
  error: string | null;
  onConfirm: () => void;
}

/** Xác nhận nộp bài: nêu số câu chưa làm (design-spec §5.2). */
export function SubmitDialog({
  open,
  onOpenChange,
  unansweredCount,
  submitting,
  error,
  onConfirm,
}: SubmitDialogProps) {
  const description =
    unansweredCount > 0
      ? `Bạn còn ${unansweredCount} câu chưa trả lời. Nộp bài?`
      : "Bạn đã trả lời tất cả các câu. Nộp bài?";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Nộp bài"
        description={description}
        size="sm"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={submitting}>
                Làm tiếp
              </Button>
            </DialogClose>
            <Button
              variant="success"
              loading={submitting}
              loadingLabel="Đang nộp…"
              onClick={onConfirm}
            >
              Nộp bài
            </Button>
          </>
        }
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </DialogContent>
    </Dialog>
  );
}

export interface TimeUpDialogProps {
  open: boolean;
  error: string | null;
  onRetry: () => void;
}

/** Hết giờ (design-spec §6.4): hộp thoại không đóng được trong lúc bài đang được nộp. */
export function TimeUpDialog({ open, error, onRetry }: TimeUpDialogProps) {
  const container = usePortalContainer();
  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-brand-dark/60" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex w-[28rem] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-lg"
        >
          <DialogPrimitive.Title className="font-display text-xl font-extrabold text-ink">
            Hết giờ. Bài của bạn đang được nộp…
          </DialogPrimitive.Title>
          {error ? (
            <Alert
              tone="danger"
              action={
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  Thử lại
                </Button>
              }
            >
              {error}
            </Alert>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
