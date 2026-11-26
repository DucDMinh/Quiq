import { normalizeExamCode } from "@quiq/shared/student";
import type { Metadata } from "next";
import { ResultView } from "@/features/student/result-view";

export const metadata: Metadata = { title: "Kết quả" };

export default async function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ResultView examCode={normalizeExamCode(code)} />;
}
