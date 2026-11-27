import type { Metadata } from "next";
import { LookupPage } from "@/features/lookup/lookup-page";
import { PortalFrame } from "@/features/student/portal-frame";

export const metadata: Metadata = { title: "Tra cứu điểm" };

// Trang công khai, vẫn hiển thị dưới 1024px (MIN_WIDTH_EXEMPT_PATHS, design-spec §1).
export default function ScoreLookupPage() {
  return (
    <PortalFrame width="result">
      <LookupPage />
    </PortalFrame>
  );
}
