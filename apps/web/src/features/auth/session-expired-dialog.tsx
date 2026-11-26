"use client";

import { Button, Dialog, DialogContent } from "@/components/ui";

export interface SessionExpiredDialogProps {
  open: boolean;
  /** Về trang đăng nhập, giữ lại trang đang xem để quay về. */
  onConfirm: () => void;
}

// Đóng bằng Esc hay nút × cũng đưa về trang đăng nhập: phiên đã mất nên không còn gì để làm ở trang này.
export function SessionExpiredDialog({ open, onConfirm }: SessionExpiredDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onConfirm())}>
      <DialogContent
        size="sm"
        title="Phiên đăng nhập đã hết hạn"
        description="Vì lý do bảo mật, bạn cần đăng nhập lại. Sau khi đăng nhập, bạn sẽ quay về trang đang xem."
        footer={<Button onClick={onConfirm}>Đăng nhập lại</Button>}
      />
    </Dialog>
  );
}
