import { QUESTION_OPTION_MAX, type Difficulty, type Question, type QuestionInput } from "@quiq/shared/questions";

// Trạng thái form soạn câu hỏi và các phép biến đổi thuần (không React), để form chỉ nối sự kiện với hàm.

export interface DraftOption {
  /** Khóa React ổn định khi thêm/xóa đáp án. */
  key: number;
  content: string;
  isCorrect: boolean;
}

export interface Draft {
  content: string;
  difficulty: Difficulty;
  multiSelect: boolean;
  options: DraftOption[];
}

/** Lỗi theo đường dẫn trường: "content", "difficulty", "options", "options.1.content". */
export type FieldErrors = Record<string, string>;

// Bộ đếm cấp module: chỉ cần khóa duy nhất trong trang, không cần ref trong lúc render.
let optionKeySeed = 0;
const newOption = (content = "", isCorrect = false): DraftOption => ({ key: ++optionKeySeed, content, isCorrect });

/** Câu mới: 4 ô đáp án trống, mức Trung bình. Câu đang sửa: chép nguyên dữ liệu. */
export function initialDraft(question: Question | null): Draft {
  if (!question) {
    return {
      content: "",
      difficulty: "medium",
      multiSelect: false,
      options: Array.from({ length: QUESTION_OPTION_MAX }, () => newOption()),
    };
  }
  return {
    content: question.content,
    difficulty: question.difficulty,
    multiSelect: question.multiSelect,
    options: question.options.map((option) => newOption(option.content, option.isCorrect)),
  };
}

export const toInput = (draft: Draft): QuestionInput => ({
  content: draft.content,
  difficulty: draft.difficulty,
  multiSelect: draft.multiSelect,
  options: draft.options.map(({ content, isCorrect }) => ({ content, isCorrect })),
});

// Lỗi kiểm ở client (zod) và `details` 422 của API cùng đi qua đây, nên hiện cùng một chỗ dưới ô.
export function toFieldErrors(issues: ReadonlyArray<{ path: string; message: string }>): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) errors[issue.path] ??= issue.message;
  return errors;
}

export const withOptionContent = (draft: Draft, index: number, content: string): Draft => ({
  ...draft,
  options: draft.options.map((option, i) => (i === index ? { ...option, content } : option)),
});

/** Câu một đáp án: chọn đáp án này thì bỏ đánh dấu các đáp án khác. */
export const withCorrectMark = (draft: Draft, index: number, checked: boolean): Draft => ({
  ...draft,
  options: draft.options.map((option, i) => {
    if (i === index) return { ...option, isCorrect: checked };
    return draft.multiSelect ? option : { ...option, isCorrect: false };
  }),
});

/** Tắt chọn nhiều: chỉ giữ đáp án đúng đầu tiên để dữ liệu luôn hợp lệ với câu một đáp án. */
export function withMultiSelect(draft: Draft, multiSelect: boolean): Draft {
  if (multiSelect) return { ...draft, multiSelect };
  const firstCorrect = draft.options.findIndex((option) => option.isCorrect);
  return {
    ...draft,
    multiSelect,
    options: draft.options.map((option, i) => ({ ...option, isCorrect: i === firstCorrect })),
  };
}

export const withAddedOption = (draft: Draft): Draft => ({ ...draft, options: [...draft.options, newOption()] });

export const withoutOption = (draft: Draft, index: number): Draft => ({
  ...draft,
  options: draft.options.filter((_, i) => i !== index),
});

const OPTION_ERROR_PATH = /^options\.(\d+)\.(.+)$/;

/**
 * Bỏ đáp án ở `index`: lỗi của đáp án đó mất, lỗi các đáp án sau dời lên một chỉ số để vẫn nằm dưới đúng ô.
 * Thêm đáp án luôn nối vào cuối nên không cần dời lỗi.
 */
export function shiftErrorsAfterRemoval(errors: FieldErrors, index: number): FieldErrors {
  const next: FieldErrors = {};
  for (const [path, message] of Object.entries(errors)) {
    const match = OPTION_ERROR_PATH.exec(path);
    if (!match) {
      next[path] = message;
      continue;
    }
    const position = Number(match[1]);
    if (position === index) continue;
    next[position > index ? `options.${position - 1}.${match[2]}` : path] = message;
  }
  return next;
}
