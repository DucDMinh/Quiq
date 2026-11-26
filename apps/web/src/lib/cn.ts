import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Khai báo tên tiện ích tùy biến từ globals.css để twMerge không xếp nhầm vào nhóm màu:
// ví dụ `text-score` là cỡ chữ, nếu không khai thì `cn("text-score", "text-ink")` sẽ bỏ mất `text-score`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["score", "control", "badge"] }],
      shadow: [{ shadow: ["card", "selected"] }],
      ease: [{ ease: ["fast"] }],
    },
  },
});

/** Gộp class điều kiện và để class đứng sau thắng khi trùng nhóm Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
