import { z } from "zod";

const MAX_CODE_LENGTH = 64;

/**
 * Mã bài thi học sinh gõ hoặc dán: bỏ mọi khoảng trắng, không phân biệt hoa thường (so khớp bằng `upper`),
 * dán nguyên link `.../thi/<mã>/...` vẫn lấy đúng mã. Web và API dùng chung một hàm.
 */
export function normalizeExamCode(input: string): string {
  const compact = input.replace(/\s+/g, "");
  const fromLink = /\/thi\/([^/?#]+)/i.exec(compact)?.[1];
  let code = fromLink ?? compact;
  try {
    code = decodeURIComponent(code);
  } catch {
    // Chuỗi % hỏng: giữ nguyên, tra không thấy thì báo "Không tìm thấy bài thi".
  }
  return code.toUpperCase();
}

/** Mã học sinh: bỏ khoảng trắng đầu cuối, so khớp không phân biệt hoa thường. */
export function normalizeStudentCode(input: string): string {
  return input.trim().toUpperCase();
}

export const enterBodySchema = z.object({
  examCode: z.string().transform(normalizeExamCode).pipe(z.string().min(1).max(MAX_CODE_LENGTH)),
  studentCode: z
    .string()
    .transform(normalizeStudentCode)
    .pipe(z.string().min(1).max(MAX_CODE_LENGTH)),
});
export type EnterBody = z.input<typeof enterBodySchema>;

export const attemptIdParamsSchema = z.object({ id: z.uuid() });

export const saveAnswerBodySchema = z.object({
  questionId: z.uuid(),
  // Mảng rỗng = bỏ chọn hết (câu chọn nhiều). Trùng id và số lượng theo loại câu do API kiểm.
  optionIds: z.array(z.uuid()).max(10),
});
export type SaveAnswerBody = z.infer<typeof saveAnswerBodySchema>;

export const STUDENT_PHASES = [
  "waiting",
  "can_start",
  "in_progress",
  "completed",
  "closed",
] as const;
export type StudentPhase = (typeof STUDENT_PHASES)[number];

/** Vì sao pha là `closed`: lớp đã thu bài, hoặc học sinh đã dùng hết lượt. */
export type ClosedReason = "class_closed" | "max_attempts";

// "interrupted" là trạng thái riêng của attempt, không phải lý do kết thúc của finalizeAttempt.
export const ATTEMPT_END_REASONS = ["submitted", "timeout", "violation", "closed"] as const;
export type AttemptEndReason = (typeof ATTEMPT_END_REASONS)[number];

export interface StudentIdentity {
  code: string;
  fullName: string | null;
}

export interface StudentStateView {
  phase: StudentPhase;
  closedReason: ClosedReason | null;
  exam: {
    code: string;
    title: string;
    subjectName: string;
    durationMinutes: number;
    questionCount: number;
  };
  student: StudentIdentity;
  className: string;
  /** Lần làm đang diễn ra hoặc vừa hoàn thành của lớp này; null khi chưa bắt đầu lần nào. */
  attempt: { id: string; attemptNo: number; endsAt: string | null } | null;
  attemptsUsed: number;
  maxAttempts: number;
  warnLimit: number;
  /** Giờ máy chủ lúc trả lời, để client bù lệch đồng hồ. */
  serverNow: string;
}

export interface PaperOption {
  id: string;
  content: string;
}

export interface PaperQuestion {
  id: string;
  content: string;
  multiSelect: boolean;
  options: PaperOption[];
}

/** Đề của một lần làm theo thứ tự đã trộn. Cố ý không có trường đáp án đúng nào. */
export interface ExamPaperView {
  attemptId: string;
  attemptNo: number;
  maxAttempts: number;
  examTitle: string;
  student: StudentIdentity;
  endsAt: string;
  serverNow: string;
  questions: PaperQuestion[];
  /** questionId -> id các đáp án đã lưu. */
  answers: Record<string, string[]>;
}

export interface SaveAnswerResult {
  questionId: string;
  optionIds: string[];
  serverNow: string;
}

/** Điểm lần vừa làm. Cố ý không có câu đã chọn hay đáp án đúng (FR-047). */
export interface AttemptResultView {
  attemptId: string;
  attemptNo: number;
  maxAttempts: number;
  score: number;
  correct: number;
  total: number;
  endReason: AttemptEndReason;
  examTitle: string;
  examCode: string;
  student: StudentIdentity;
}
