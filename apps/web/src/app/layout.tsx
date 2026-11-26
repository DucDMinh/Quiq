import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MinWidthGuard } from "@/components/min-width-guard";
import { ToastProvider } from "@/components/ui/toast";
import { fontVariableClasses } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Quiq | Thi trắc nghiệm trực tuyến",
    template: "%s | Quiq",
  },
  description: "Hệ thống thi trắc nghiệm trực tuyến",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={fontVariableClasses}>
      <body className="font-sans">
        <MinWidthGuard>
          <ToastProvider>{children}</ToastProvider>
        </MinWidthGuard>
      </body>
    </html>
  );
}
