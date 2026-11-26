"use client";

import { createContext, useContext } from "react";

// Radix portal mặc định ra <body>, nằm ngoài vùng nội dung mà MinWidthGuard ẩn khi màn hẹp.
// MinWidthGuard cấp một phần tử bên trong vùng đó; Dialog/Select portal vào đây nên bị ẩn cùng nội dung.
// Không có provider thì trả undefined và Radix dùng <body> như bình thường.
const PortalContainerContext = createContext<HTMLElement | null>(null);

export const PortalContainerProvider = PortalContainerContext.Provider;

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}
