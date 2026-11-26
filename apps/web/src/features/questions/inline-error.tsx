import { IconAlertCircle } from "@tabler/icons-react";

/** Lỗi ngay dưới ô hoặc nhóm ô, cùng quy cách với lỗi của Field (chữ đỏ + icon, đọc được bằng trình đọc màn hình). */
export function InlineError({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-sm text-danger-text">
      <IconAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
