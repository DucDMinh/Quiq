import type { ReactNode } from "react";
import { AppShell } from "@/features/shell/app-shell";

// Mọi trang /giao-vien/* nằm trong khung cán bộ; AppShell chặn khi chưa đăng nhập hoặc sai vai trò.
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return <AppShell role="teacher">{children}</AppShell>;
}
