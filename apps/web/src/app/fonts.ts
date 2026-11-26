import { Be_Vietnam_Pro, IBM_Plex_Mono, Montserrat } from "next/font/google";

// next/font tải font lúc build và tự host; trình duyệt không gọi Google Fonts lúc chạy.
// Subset `vietnamese` bắt buộc để hiển thị đủ dấu (ắ, ể, ữ, ợ, ặ).
// Tham số phải là literal ngay tại chỗ gọi (next/font phân tích tĩnh), nên không dùng chung biến.
export const montserrat = Montserrat({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-montserrat",
});

export const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam-pro",
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
});

export const fontVariableClasses = [
  montserrat.variable,
  beVietnamPro.variable,
  ibmPlexMono.variable,
].join(" ");
