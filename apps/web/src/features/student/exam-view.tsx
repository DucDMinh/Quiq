"use client";

import type { ExamPaperView, PaperQuestion } from "@quiq/shared/student";
import { useState } from "react";
import { Alert, AnswerTileGroup, Badge, Button, Card, Skeleton, Timer } from "@/components/ui";
import { LoadError } from "./portal-frame";
import { isAnswered, QuestionNav } from "./question-nav";
import { examPath, isSessionError } from "./student-api";
import { SubmitDialog, TimeUpDialog } from "./submit-dialog";
import { useCountdown, useExamAttempt, useExamKeys } from "./use-exam-attempt";

interface QuestionCardProps {
  question: PaperQuestion;
  index: number;
  total: number;
  selectedIds: string[];
  onChange: (optionIds: string[]) => void;
  onMove: (index: number) => void;
}

function QuestionCard({
  question,
  index,
  total,
  selectedIds,
  onChange,
  onMove,
}: QuestionCardProps) {
  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap gap-2">
        <Badge tone="brand" className="font-mono">
          Câu {index + 1} / {total}
        </Badge>
        <Badge tone="info">
          {question.multiSelect ? "Chọn nhiều đáp án đúng" : "Chọn 1 đáp án đúng"}
        </Badge>
      </div>
      <p className="font-display text-xl font-extrabold break-words whitespace-pre-line text-ink">
        {question.content}
      </p>
      <AnswerTileGroup
        aria-label={`Đáp án câu ${index + 1}`}
        multiple={question.multiSelect}
        options={question.options.map((option) => ({ id: option.id, label: option.content }))}
        selectedIds={selectedIds}
        onChange={onChange}
      />
      <div className="flex justify-between">
        <Button variant="secondary" disabled={index === 0} onClick={() => onMove(index - 1)}>
          Câu trước
        </Button>
        <Button
          variant="secondary"
          disabled={index === total - 1}
          onClick={() => onMove(index + 1)}
        >
          Câu tiếp
        </Button>
      </div>
    </Card>
  );
}

/** Lựa chọn mới khi bấm phím vị trí `position`: câu chọn 1 thay đáp án, câu chọn nhiều bật/tắt. */
function selectionByKey(
  question: PaperQuestion,
  current: string[],
  position: number,
): string[] | null {
  const option = question.options[position];
  if (!option) return null;
  if (!question.multiSelect) return [option.id];
  return current.includes(option.id)
    ? current.filter((id) => id !== option.id)
    : [...current, option.id];
}

interface ExamTopbarProps {
  paper: ExamPaperView;
  remaining: number;
  answeredCount: number;
  onSubmit: () => void;
}

/** Topbar teal của exam shell: tên bài, thí sinh, đồng hồ, nút Nộp bài (design-spec §3). */
function ExamTopbar({ paper, remaining, answeredCount, onSubmit }: ExamTopbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-brand px-8 py-3 text-on-brand">
      <div className="mx-auto flex max-w-(--layout-exam-max) items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-extrabold">{paper.examTitle}</p>
          <p className="text-sm text-on-brand-muted">
            Thí sinh: {paper.student.fullName ?? paper.student.code} ({paper.student.code}) · Lần
            làm {paper.attemptNo}/{paper.maxAttempts}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Timer remainingSeconds={remaining} />
          <Button variant="success" onClick={onSubmit}>
            Nộp bài ({answeredCount}/{paper.questions.length})
          </Button>
        </div>
      </div>
    </header>
  );
}

function UnsavedAlert({ count, onRetry }: { count: number; onRetry: () => void }) {
  if (count === 0) return null;
  return (
    <Alert
      tone="warning"
      action={
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Thử lại
        </Button>
      }
    >
      Chưa lưu được đáp án của {count} câu. Đáp án vẫn được giữ trên máy này.
    </Alert>
  );
}

type Attempt = ReturnType<typeof useExamAttempt>;

interface ExamBodyProps {
  paper: ExamPaperView;
  attempt: Attempt;
  currentIndex: number;
  onMove: (index: number) => void;
}

/** Thân exam shell 2 cột: thẻ câu hỏi bên trái, danh sách câu 310px bên phải. */
function ExamBody({ paper, attempt, currentIndex, onMove }: ExamBodyProps) {
  const question = paper.questions[currentIndex];
  return (
    <main className="mx-auto grid w-full max-w-(--layout-exam-max) grid-cols-[1fr_var(--layout-exam-aside)] gap-6 px-8 py-6">
      <div className="flex flex-col gap-4">
        <UnsavedAlert count={attempt.unsaved.length} onRetry={attempt.retryUnsaved} />
        {question ? (
          <QuestionCard
            question={question}
            index={currentIndex}
            total={paper.questions.length}
            selectedIds={attempt.answers[question.id] ?? []}
            onChange={(optionIds) => attempt.select(question.id, optionIds)}
            onMove={onMove}
          />
        ) : null}
      </div>
      <QuestionNav
        questions={paper.questions}
        answers={attempt.answers}
        currentIndex={currentIndex}
        onSelect={onMove}
      />
    </main>
  );
}

interface ExamShellProps {
  paper: ExamPaperView;
  offsetMs: number;
  attempt: Attempt;
}

function ExamShell({ paper, offsetMs, attempt }: ExamShellProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const remaining = useCountdown(paper.endsAt, offsetMs, () => {
    setTimeUp(true);
    void attempt.submit();
  });
  const total = paper.questions.length;
  const question = paper.questions[currentIndex];
  const answeredCount = paper.questions.filter((q) => isAnswered(attempt.answers, q.id)).length;
  const choose = (position: number) => {
    if (!question) return;
    const next = selectionByKey(question, attempt.answers[question.id] ?? [], position);
    if (next) attempt.select(question.id, next);
  };
  const step = (delta: number) =>
    setCurrentIndex((index) => Math.min(total - 1, Math.max(0, index + delta)));
  useExamKeys(!confirmOpen && !timeUp, choose, step);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <ExamTopbar
        paper={paper}
        remaining={remaining}
        answeredCount={answeredCount}
        onSubmit={() => setConfirmOpen(true)}
      />
      <ExamBody
        paper={paper}
        attempt={attempt}
        currentIndex={currentIndex}
        onMove={setCurrentIndex}
      />
      <SubmitDialog
        open={confirmOpen && !timeUp}
        onOpenChange={setConfirmOpen}
        unansweredCount={total - answeredCount}
        submitting={attempt.submitting}
        error={attempt.submitError}
        onConfirm={() => void attempt.submit()}
      />
      <TimeUpDialog
        open={timeUp}
        error={attempt.submitError}
        onRetry={() => void attempt.submit()}
      />
    </div>
  );
}

/** Làm bài (design-spec §5.2, FR-041, FR-042): exam shell, lưu đáp án mỗi lần chọn, đồng hồ theo giờ máy chủ. */
export function ExamView({ examCode }: { examCode: string }) {
  const attempt = useExamAttempt(examCode);
  const { load } = attempt;
  if (load.status === "ready")
    return <ExamShell paper={load.paper} offsetMs={load.offsetMs} attempt={attempt} />;
  return (
    <main className="mx-auto flex min-h-dvh max-w-(--layout-exam-max) flex-col gap-6 px-8 py-6">
      {load.status === "error" ? (
        <LoadError
          message={load.error.message}
          onRetry={attempt.reload}
          enterHref={isSessionError(load.error) ? examPath(examCode) : undefined}
        />
      ) : (
        <div className="grid grid-cols-[1fr_var(--layout-exam-aside)] gap-6" aria-busy="true">
          <span className="sr-only">Đang tải đề…</span>
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      )}
    </main>
  );
}
