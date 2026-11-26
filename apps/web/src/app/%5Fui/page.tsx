import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiGallery } from "./gallery";

// Thư mục tên `%5Fui` để Next tạo đường dẫn `/_ui` (tiền tố `_` thật sự sẽ bị coi là thư mục private, không có route).
export const metadata: Metadata = { title: "Thư viện giao diện", robots: { index: false, follow: false } };

// Trang xem bằng mắt các thành phần dùng chung; chỉ có ở môi trường dev.
export default function UiGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiGallery />;
}
