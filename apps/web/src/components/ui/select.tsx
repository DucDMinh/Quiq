"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import type { ComponentProps } from "react";
import { usePortalContainer } from "@/components/portal-container";
import { cn } from "@/lib/cn";
import { controlClassName } from "./input";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Pick<
    ComponentProps<typeof SelectPrimitive.Trigger>,
    "id" | "aria-describedby" | "aria-invalid" | "aria-label" | "className"
  > {
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
}

// Giá trị rỗng không hợp lệ với Radix Select; dùng `placeholder` cho trạng thái chưa chọn.
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Chọn một mục",
  name,
  disabled,
  required,
  className,
  ...triggerProps
}: SelectProps) {
  const container = usePortalContainer();
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      name={name}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        className={cn(controlClassName, "flex items-center justify-between gap-2 text-left", className)}
        {...triggerProps}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <IconChevronDown size={18} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={container}>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-md border border-line bg-surface shadow-lg"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex min-h-(--control-height-sm) cursor-pointer select-none items-center rounded-sm py-1.5 pr-8 pl-3 text-base text-ink outline-none data-disabled:cursor-not-allowed data-disabled:opacity-[0.48] data-highlighted:bg-brand-tint-soft data-highlighted:text-brand-dark"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
                  <IconCheck size={16} aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
