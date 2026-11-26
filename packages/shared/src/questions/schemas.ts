import { z } from "zod";
import { QUESTION_MESSAGES as M } from "./errors";
import {
  OPTION_CONTENT_MAX,
  QUESTION_CONTENT_MAX,
  QUESTION_OPTION_MAX,
  QUESTION_OPTION_MIN,
  QUESTION_PAGE_MAX,
} from "./limits";

// Khớp DIFFICULTIES của @quiq/db (gói shared không phụ thuộc db); questions.test.ts của api kiểm hai danh sách bằng nhau.
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

export const questionOptionInputSchema = z.object({
  content: z.string().trim().min(1, M.optionContentRequired).max(OPTION_CONTENT_MAX, M.optionContentTooLong),
  isCorrect: z.boolean(),
});

/**
 * Thân POST/PUT câu hỏi. Môn và chủ sở hữu KHÔNG có ở đây: API lấy từ phiên giáo viên,
 * khóa lạ client gửi lên (subjectId, teacherId, ...) bị zod bỏ đi.
 * `multiSelect` là cờ rõ ràng: tắt thì phải đúng 1 đáp án đúng, bật thì ít nhất 1.
 */
export const questionInputSchema = z
  .object({
    content: z.string().trim().min(1, M.contentRequired).max(QUESTION_CONTENT_MAX, M.contentTooLong),
    difficulty: z.enum(DIFFICULTIES, M.difficultyInvalid),
    multiSelect: z.boolean(),
    options: z
      .array(questionOptionInputSchema)
      .min(QUESTION_OPTION_MIN, M.tooFewOptions)
      .max(QUESTION_OPTION_MAX, M.tooManyOptions),
  })
  .superRefine((value, ctx) => {
    let correctCount = 0;
    for (const option of value.options) if (option.isCorrect) correctCount += 1;
    if (correctCount === 0) {
      ctx.addIssue({ code: "custom", path: ["options"], message: M.noCorrectOption });
    } else if (!value.multiSelect && correctCount > 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: M.singleSelectNeedsOneCorrect });
    }
  });

export type QuestionInput = z.infer<typeof questionInputSchema>;

export const questionListQuerySchema = z.object({
  difficulty: z.enum(DIFFICULTIES, M.difficultyInvalid).optional(),
  page: z.coerce.number(M.pageInvalid).int(M.pageInvalid).min(1, M.pageInvalid).max(QUESTION_PAGE_MAX, M.pageInvalid).default(1),
});

export type QuestionListQuery = z.infer<typeof questionListQuerySchema>;

export interface QuestionOption {
  id: string;
  content: string;
  isCorrect: boolean;
  /** Thứ tự hiển thị, bắt đầu từ 0 (A, B, C, D). */
  position: number;
}

export interface Question {
  id: string;
  content: string;
  difficulty: Difficulty;
  multiSelect: boolean;
  options: QuestionOption[];
  createdAt: string;
  updatedAt: string;
}

/** Số câu của giáo viên theo mức, không phụ thuộc bộ lọc (cho 4 thẻ KPI). */
export interface QuestionStats {
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

/** Response `GET /api/teacher/questions`. */
export interface QuestionListResult {
  /** Môn cố định của giáo viên, để tiêu đề trang nêu môn. */
  subject: { id: string; name: string };
  stats: QuestionStats;
  items: Question[];
  /** Tổng số câu khớp bộ lọc hiện tại. */
  total: number;
  page: number;
  pageSize: number;
}
