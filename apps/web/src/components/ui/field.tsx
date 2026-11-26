"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import { IconAlertCircle } from "@tabler/icons-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Thuộc tính Field truyền xuống ô nhập để nhãn, hint và lỗi nối đúng với điều khiển. */
export interface FieldControlProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  required: boolean | undefined;
}

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

// Children là hàm (render-prop) nên Field chỉ dùng được bên trong client component:
// hàm không đi qua được ranh giới Server Component. Nhãn luôn hiện phía trên (không dùng placeholder thay nhãn), lỗi nằm ngay dưới ô.
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const baseId = useId();
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <LabelPrimitive.Root htmlFor={baseId} className="text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-quiq-red" aria-hidden="true">
            *
          </span>
        ) : null}
      </LabelPrimitive.Root>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children({
        id: baseId,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
        required: required || undefined,
      })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-danger-text">
          <IconAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
