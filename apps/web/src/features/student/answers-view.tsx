"use client";

import type { AnswerKeyQuestion, AttemptAnswersView } from "@quiq/shared/student";
import { useCallback, useState } from "react";
import { Alert, ANSWER_LETTERS, Badge, LetterBadge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { studentApi, toApiError } from "./student-api";

export type AnswersLoad =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; view: AttemptAnswersView };

/** Mỗi lần bấm "Xem đáp án" hỏi lại máy chủ, để thấy ngay khi giáo viên vừa công bố (không cần tải lại trang). */
export function useAttemptAnswers(attemptId: string) {
  const [load, setLoad] = useState<AnswersLoad>({ status: "idle" });
  const show = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      setLoad({ status: "ready", view: await studentApi.answers(attemptId) });
    } catch (cause) {
      // Chưa công bố: máy chủ trả ANSWERS_NOT_PUBLISHED với thông điệp "Giáo viên chưa công bố đáp án.".
      setLoad({ status: "error", message: toApiError(cause).message });
    }
  }, [attemptId]);
  return { load, show };
}

function AnswerKeyCard({ question, index, total }: { question: AnswerKeyQuestion; index: number; total: number }) {
  return (
    <li className="flex flex-col gap-3 rounded-md border border-line p-4">
      <div className="flex items-center gap-2">
        <Badge tone="brand">
          Câu {index + 1} / {total}
        </Badge>
        <Badge>{question.multiSelect ? "Chọn nhiều đáp án đúng" : "Chọn 1 đáp án đúng"}</Badge>
      </div>
      <p className="text-base font-semibold break-words whitespace-pre-line text-ink">{question.content}</p>
      <ul className="grid grid-cols-2 gap-2">
        {question.options.map((option, position) => {
          const letter = ANSWER_LETTERS[position];
          return (
            <li
              key={option.id}
              data-correct={option.isCorrect || undefined}
              className={cn(
                "flex items-center gap-3 rounded-md border p-3",
                option.isCorrect ? "border-2 border-success-border bg-success-bg" : "border-line",
              )}
            >
              {letter ? <LetterBadge letter={letter} className="border border-line" /> : null}
              <span className="min-w-0 flex-1 break-words text-ink">{option.content}</span>
              {option.isCorrect ? <Badge tone="success">Đúng</Badge> : null}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/** Khối "Đề thi và đáp án đúng" (design-spec §5.3). Cố ý không hiển thị câu học sinh đã chọn (FR-047). */
export function AnswersPanel({ load }: { load: AnswersLoad }) {
  if (load.status === "idle" || load.status === "loading") return null;
  if (load.status === "error") return <Alert tone="danger">{load.message}</Alert>;
  const { questions } = load.view;
  return (
    <section aria-labelledby="answer-key-title" className="flex flex-col gap-4">
      <h2 id="answer-key-title" className="font-display text-xl font-extrabold text-ink">
        Đề thi và đáp án đúng
      </h2>
      <ol className="flex flex-col gap-4">
        {questions.map((question, index) => (
          <AnswerKeyCard key={question.id} question={question} index={index} total={questions.length} />
        ))}
      </ol>
    </section>
  );
}
