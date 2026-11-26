import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Nút nổi khối: viền dưới dày ("lip") đổi màu theo biến thể, nhấn dịch xuống 2px.
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-sm border border-b-(length:--lip-width) font-display font-bold leading-tight whitespace-nowrap",
    "transition-[background-color,border-color,transform,filter] duration-150 ease-fast",
    "enabled:active:translate-y-0.5 enabled:active:border-b-(length:--lip-pressed)",
    "disabled:cursor-not-allowed disabled:opacity-[0.48]",
  ],
  {
    variants: {
      variant: {
        primary:
          "border-brand border-b-brand-dark bg-brand text-on-brand enabled:hover:bg-brand-hover",
        secondary:
          "border-line-strong border-b-line-strong bg-surface text-ink enabled:hover:bg-subtle",
        subtle: "border-line border-b-line-strong bg-subtle text-ink enabled:hover:bg-hovered",
        success:
          "border-quiq-green border-b-quiq-green-lip bg-quiq-green text-on-brand enabled:hover:brightness-110",
        danger:
          "border-quiq-red border-b-quiq-red-lip bg-quiq-red text-on-brand enabled:hover:brightness-110",
        "danger-outline":
          "border-quiq-red border-b-quiq-red-lip bg-surface text-quiq-red enabled:hover:bg-danger-bg",
      },
      size: {
        sm: "min-h-(--control-height-sm) border-b-(length:--lip-width-sm) px-3 text-sm",
        md: "min-h-(--control-height-md) px-5 text-control",
        lg: "min-h-(--control-height-lg) px-6 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

export interface ButtonProps extends ComponentProps<"button">, ButtonVariants {
  /** Đang xử lý: khóa nút, đổi nhãn nhưng giữ nguyên kích thước. */
  loading?: boolean;
  loadingLabel?: string;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  loadingLabel = "Đang lưu…",
  type = "button",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        // Hai nhãn xếp chồng cùng ô lưới: chiều rộng nút bằng nhãn dài hơn nên không nhảy kích thước.
        <span className="inline-grid">
          <span className="invisible col-start-1 row-start-1" aria-hidden="true">
            {children}
          </span>
          <span className="col-start-1 row-start-1 text-center">{loadingLabel}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export interface IconButtonProps extends Omit<ComponentProps<"button">, "aria-label">, ButtonVariants {
  /** Bắt buộc: nút chỉ có icon phải có tên truy cập. */
  label: string;
}

export function IconButton({
  label,
  className,
  variant = "subtle",
  size = "md",
  type = "button",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(buttonVariants({ variant, size }), "aspect-square px-0", className)}
      {...props}
    >
      {children}
    </button>
  );
}
