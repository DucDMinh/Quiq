import type { PaperQuestion } from "@quiq/shared/student";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface QuestionNavProps {
  questions: readonly PaperQuestion[];
  answers: Readonly<Record<string, string[]>>;
  currentIndex: number;
  onSelect: (index: number) => void;
}

export const isAnswered = (answers: Readonly<Record<string, string[]>>, questionId: string) =>
  (answers[questionId]?.length ?? 0) > 0;

/** Danh sách câu (design-spec §5.2): hiện tại viền teal đậm, đã trả lời nền teal, chưa trả lời nền trắng. */
export function QuestionNav({ questions, answers, currentIndex, onSelect }: QuestionNavProps) {
  let answeredCount = 0;
  for (const question of questions) if (isAnswered(answers, question.id)) answeredCount += 1;

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-bold text-ink">Danh sách câu hỏi</h2>
      <nav aria-label="Danh sách câu hỏi" className="grid grid-cols-5 gap-2">
        {questions.map((question, index) => {
          const answered = isAnswered(answers, question.id);
          const current = index === currentIndex;
          return (
            <button
              key={question.id}
              type="button"
              aria-current={current ? "step" : undefined}
              aria-label={`Câu ${index + 1}, ${answered ? "đã trả lời" : "chưa trả lời"}`}
              data-answered={answered || undefined}
              onClick={() => onSelect(index)}
              className={cn(
                "min-h-11 rounded-sm border-2 font-mono text-base font-bold tabular-nums",
                answered
                  ? "border-brand bg-brand text-on-brand"
                  : "border-line-strong bg-surface text-ink",
                current && "border-brand-dark ring-2 ring-brand-dark ring-offset-1",
              )}
            >
              {index + 1}
            </button>
          );
        })}
      </nav>
      <p className="text-base font-semibold text-ink">
        Đã trả lời {answeredCount}/{questions.length} câu
      </p>
      <p className="text-sm text-ink-muted">Thứ tự câu và đáp án đã được xáo riêng cho bạn.</p>
    </Card>
  );
}
