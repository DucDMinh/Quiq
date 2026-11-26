"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Radix Tabs: mũi tên trái/phải đổi tab, Home/End nhảy đầu/cuối.
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex gap-1 border-b border-line", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px min-h-(--control-height-md) border-b-(length:--lip-width-sm) border-transparent px-4 font-display text-control font-bold text-ink-secondary transition-colors duration-150 ease-fast",
        "enabled:hover:text-ink data-[state=active]:border-brand data-[state=active]:text-brand",
        "disabled:cursor-not-allowed disabled:opacity-[0.48]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("pt-4", className)} {...props} />;
}
