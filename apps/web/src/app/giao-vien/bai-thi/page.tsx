"use client";

import { useState } from "react";
import { Alert, Button, EmptyState, Skeleton, useToast } from "@/components/ui";
import { CreateExamDialog } from "@/features/exams/create-exam-dialog";
import { ExamTable } from "@/features/exams/exam-table";
import { useExams } from "@/features/exams/use-exams";

export default function ExamsPage() {
  const { exams, error, reload } = useExams();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);

  const createButton = <Button onClick={() => setCreating(true)}>Tạo bài thi</Button>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Bài thi</h1>
          <p className="text-ink-secondary">Ra đề từ ngân hàng câu hỏi, gán lớp và chia sẻ mã bài thi.</p>
        </div>
        {createButton}
      </header>
      {error ? (
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={reload}>Thử lại</Button>}>
          {error.message}
        </Alert>
      ) : exams === null ? (
        <Skeleton className="h-64 w-full" />
      ) : exams.length === 0 ? (
        <EmptyState
          title="Chưa có bài thi nào"
          description="Tạo bài thi đầu tiên: chọn số câu theo mức và các lớp được gán."
          action={createButton}
        />
      ) : (
        <ExamTable exams={exams} onChanged={reload} />
      )}
      <CreateExamDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(exam) => {
          toast({ tone: "success", title: `Đã tạo bài thi ${exam.title}`, description: `Mã bài thi: ${exam.code}` });
          reload();
        }}
      />
    </div>
  );
}
