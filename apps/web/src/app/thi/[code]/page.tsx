import { normalizeExamCode } from "@quiq/shared/student";
import type { Metadata } from "next";
import { EnterForm } from "@/features/student/enter-form";
import { PortalFrame } from "@/features/student/portal-frame";

export const metadata: Metadata = { title: "Vào thi" };

// Mở bằng link /thi/[mã]: ô mã bài thi điền sẵn và khóa.
export default async function EnterWithCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <PortalFrame>
      <EnterForm initialExamCode={normalizeExamCode(code)} />
    </PortalFrame>
  );
}
