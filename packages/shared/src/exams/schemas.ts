import { z } from "zod";

export const DIFFICULTY_LEVELS = ["easy", "medium", "hard"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

export const MAX_EXAM_QUESTIONS = 200;
export const MAX_EXAM_MINUTES = 300;
const MAX_TITLE_LENGTH = 200;
const MAX_CLASSES_PER_EXAM = 50;

/** Cùng một câu báo thiếu cho API (422) và web (báo tại chỗ trong dialog tạo bài thi). */
export function insufficientQuestionsMessage(
  difficulty: DifficultyLevel,
  have: number,
  need: number,
): string {
  return `Ngân hàng chỉ có ${have} câu ${DIFFICULTY_LABELS[difficulty]}, cần ${need}.`;
}

/** Link học sinh mở để vào thi (FR-032). */
export function examLink(code: string): string {
  return `/thi/${code}`;
}

const questionCount = z
  .number({ error: "Hãy nhập số câu." })
  .int("Số câu phải là số nguyên.")
  .min(0, "Số câu không được âm.")
  .max(MAX_EXAM_QUESTIONS, `Tối đa ${MAX_EXAM_QUESTIONS} câu.`);

export const drawConfigSchema = z
  .object({ total: questionCount, easy: questionCount, medium: questionCount, hard: questionCount })
  .refine((c) => c.total > 0 && c.easy + c.medium + c.hard === c.total, {
    message: "Tổng số câu phải lớn hơn 0 và bằng số câu Dễ + Trung bình + Khó.",
    path: ["total"],
  });
export type DrawConfigInput = z.infer<typeof drawConfigSchema>;

export const createExamBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Hãy nhập tên bài thi.")
    .max(MAX_TITLE_LENGTH, `Tên bài thi tối đa ${MAX_TITLE_LENGTH} ký tự.`),
  durationMinutes: z
    .number({ error: "Hãy nhập thời gian làm bài." })
    .int("Thời gian phải là số phút nguyên.")
    .min(1, "Thời gian tối thiểu 1 phút.")
    .max(MAX_EXAM_MINUTES, `Thời gian tối đa ${MAX_EXAM_MINUTES} phút.`),
  drawConfig: drawConfigSchema,
  classIds: z
    .array(z.uuid())
    .min(1, "Hãy chọn ít nhất một lớp.")
    .max(MAX_CLASSES_PER_EXAM)
    .transform((ids) => [...new Set(ids)]),
});
export type CreateExamBody = z.input<typeof createExamBodySchema>;
export type CreateExamInput = z.output<typeof createExamBodySchema>;

export const examIdParamsSchema = z.object({ id: z.uuid() });
export const examClassParamsSchema = z.object({ examId: z.uuid(), classId: z.uuid() });

export type ExamClassStatusView = "draft" | "dispatched" | "closed";

export const EXAM_CLASS_STATUS_LABELS: Record<ExamClassStatusView, string> = {
  draft: "Chưa phát đề",
  dispatched: "Đã phát đề",
  closed: "Đã thu bài",
};

export interface DrawConfigView {
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface ExamClassSummary {
  classId: string;
  className: string;
  status: ExamClassStatusView;
}

export interface ExamListItem {
  id: string;
  code: string;
  link: string;
  title: string;
  durationMinutes: number;
  drawConfig: DrawConfigView;
  classes: ExamClassSummary[];
  /** Số lần làm (mọi trạng thái) của mọi lớp; > 0 thì không xóa được (BR-002). */
  attemptCount: number;
  createdAt: string;
}

export interface ExamOptionView {
  id: string;
  content: string;
  isCorrect: boolean;
  position: number;
}

export interface ExamQuestionView {
  id: string;
  content: string;
  difficulty: DifficultyLevel;
  multiSelect: boolean;
  position: number;
  options: ExamOptionView[];
}

/** Bản sao đề (kèm đáp án đúng vì người xem là giáo viên ra đề). */
export interface ExamDetailView extends ExamListItem {
  questions: ExamQuestionView[];
}

export interface AssignableClass {
  classId: string;
  className: string;
  academicYearName: string;
}

export type BankCounts = Record<DifficultyLevel, number>;

export const ROSTER_STATUSES = ["not_started", "waiting", "in_progress", "submitted"] as const;
export type RosterStatus = (typeof ROSTER_STATUSES)[number];

export const ROSTER_STATUS_LABELS: Record<RosterStatus, string> = {
  not_started: "Chưa làm",
  waiting: "Đang chờ",
  in_progress: "Đang làm",
  submitted: "Đã nộp",
};

export interface ExamClassState {
  examId: string;
  classId: string;
  className: string;
  status: ExamClassStatusView;
  dispatchedAt: string | null;
  closedAt: string | null;
  /** Snapshot chụp lúc phát đề (C-04, C-06); null khi chưa phát đề. */
  maxAttempts: number | null;
  warnLimit: number | null;
  interruptSecs: number | null;
}

export interface RosterStudent {
  studentId: string;
  code: string;
  fullName: string | null;
  status: RosterStatus;
  attemptsUsed: number;
  /** Điểm cao nhất trong các lần đã nộp; null khi chưa nộp lần nào. */
  bestScore: number | null;
}

export interface RosterView {
  examClass: ExamClassState;
  students: RosterStudent[];
  counts: Record<RosterStatus, number>;
  serverNow: string;
}

export interface CloseClassResult {
  examClass: ExamClassState;
  /** Số lần làm đang diễn ra đã bị nộp và chấm ngay khi thu bài. */
  finalizedAttempts: number;
}
