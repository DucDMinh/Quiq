import { normalizeExamCode } from "@quiq/shared/student";
import type { Metadata } from "next";
import { ExamView } from "@/features/student/exam-view";

export const metadata: Metadata = { title: "Làm bài" };

export default async function ExamPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ExamView examCode={normalizeExamCode(code)} />;
}
