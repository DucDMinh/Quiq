import { DIFFICULTY_LABELS, type Difficulty, type Question } from "@quiq/shared/questions";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { ANSWER_LETTERS, Badge, Button, type BadgeTone } from "@/components/ui";

const DIFFICULTY_TONE: Record<Difficulty, BadgeTone> = { easy: "success", medium: "warning", hard: "danger" };

const SNIPPET_LENGTH = 60;

/** Đoạn đầu nội dung câu, để nút Sửa/Xóa của từng dòng có tên riêng cho trình đọc màn hình. */
export function questionSnippet(content: string): string {
  return content.length > SNIPPET_LENGTH ? `${content.slice(0, SNIPPET_LENGTH)}…` : content;
}

function correctAnswersText(question: Question): string {
  const letters: string[] = [];
  for (const option of question.options) {
    if (option.isCorrect) letters.push(ANSWER_LETTERS[option.position] ?? "?");
  }
  return letters.join(", ");
}

export interface QuestionRowProps {
  question: Question;
  onEdit: (question: Question) => void;
  onDelete: (question: Question) => void;
}

/** Một câu trong danh sách: nội dung rút gọn 2 dòng, badge mức, đáp án đúng, nút Sửa/Xóa. */
export function QuestionRow({ question, onEdit, onDelete }: QuestionRowProps) {
  const snippet = questionSnippet(question.content);
  return (
    <li className="flex items-start gap-4 rounded-md border border-line bg-surface p-4 shadow-card">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-base text-ink">{question.content}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
          <Badge tone={DIFFICULTY_TONE[question.difficulty]}>{DIFFICULTY_LABELS[question.difficulty]}</Badge>
          {question.multiSelect ? <Badge tone="info">Nhiều đáp án</Badge> : null}
          <span>
            {question.options.length} đáp án · Đáp án đúng:{" "}
            <span className="font-mono font-bold text-ink">{correctAnswersText(question)}</span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" size="sm" aria-label={`Sửa câu hỏi: ${snippet}`} onClick={() => onEdit(question)}>
          <IconPencil size={16} aria-hidden="true" />
          Sửa
        </Button>
        <Button
          variant="danger-outline"
          size="sm"
          aria-label={`Xóa câu hỏi: ${snippet}`}
          onClick={() => onDelete(question)}
        >
          <IconTrash size={16} aria-hidden="true" />
          Xóa
        </Button>
      </div>
    </li>
  );
}
