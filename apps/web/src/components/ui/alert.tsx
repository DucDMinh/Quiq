import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconMessage,
  type Icon,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertTone = "success" | "info" | "warning" | "danger" | "neutral";

// Dùng chung cho Alert và Toast để hai thành phần luôn cùng bảng màu và icon.
export const ALERT_TONES: Record<AlertTone, { classes: string; Icon: Icon }> = {
  success: { classes: "border-success-border bg-success-bg text-success-text", Icon: IconCircleCheck },
  info: { classes: "border-info-border bg-info-bg text-info-text", Icon: IconInfoCircle },
  warning: { classes: "border-warning-border bg-warning-bg text-warning-text", Icon: IconAlertTriangle },
  danger: { classes: "border-danger-border bg-danger-bg text-danger-text", Icon: IconAlertOctagon },
  neutral: { classes: "border-neutral-border bg-neutral-bg text-neutral-text", Icon: IconMessage },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  /** Nút hoặc liên kết hành động (ví dụ "Thử lại"). */
  action?: ReactNode;
  className?: string;
}

// Icon + chữ, không chỉ màu. Lỗi dùng role="alert", còn lại role="status".
export function Alert({ tone = "info", title, children, action, className }: AlertProps) {
  const { classes, Icon: ToneIcon } = ALERT_TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-md border px-4 py-3", classes, className)}
    >
      <ToneIcon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-base">
        {title ? <p className="font-display font-bold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : undefined}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
