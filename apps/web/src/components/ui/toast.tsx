"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { IconX } from "@tabler/icons-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ALERT_TONES, type AlertTone } from "./alert";
import { IconButton } from "./button";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: AlertTone;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastApi {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = 5000;
const DURATION_ERROR_MS = 8000;

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast phải nằm trong <ToastProvider>.");
  return context;
}

// Góc dưới phải, vùng thông báo aria-live="polite". Toast lỗi ở lâu hơn (8 giây).
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((input: ToastInput) => {
    nextId.current += 1;
    const item: ToastItem = { ...input, id: nextId.current };
    setItems((current) => [...current, item]);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      <ToastPrimitive.Provider label="Thông báo" swipeDirection="right">
        {children}
        {items.map((item) => {
          const tone = item.tone ?? "neutral";
          const { classes, Icon } = ALERT_TONES[tone];
          return (
            <ToastPrimitive.Root
              key={item.id}
              // Toast lỗi dùng mức assertive để người dùng trình đọc màn hình biết ngay; còn lại polite.
              type={tone === "danger" ? "foreground" : "background"}
              duration={tone === "danger" ? DURATION_ERROR_MS : DURATION_MS}
              onOpenChange={(open) => {
                if (!open) remove(item.id);
              }}
              className={cn("flex items-start gap-3 rounded-md border px-4 py-3 shadow-lg", classes)}
            >
              <Icon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="font-display font-bold">{item.title}</ToastPrimitive.Title>
                {item.description ? (
                  <ToastPrimitive.Description className="mt-0.5 text-sm">
                    {item.description}
                  </ToastPrimitive.Description>
                ) : null}
              </div>
              <ToastPrimitive.Close asChild>
                <IconButton label="Đóng thông báo" size="sm" variant="secondary">
                  <IconX size={16} aria-hidden="true" />
                </IconButton>
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport
          label="Thông báo ({hotkey})"
          aria-live="polite"
          className="fixed right-4 bottom-4 z-[100] m-0 flex w-[24rem] max-w-[calc(100vw-2rem)] list-none flex-col gap-2 p-0 outline-none"
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
