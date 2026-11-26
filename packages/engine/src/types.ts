// Kiểu cục bộ của engine. Cố ý tách khỏi gói db/shared để engine không phụ thuộc chéo;
// tầng api tự ánh xạ bản ghi DB sang các kiểu cấu trúc tương thích này.

export type Difficulty = "easy" | "medium" | "hard";

/** Trả về số nguyên ngẫu nhiên trong [0, maxExclusive). Tiêm được để test xác định. */
export type Rng = (maxExclusive: number) => number;

export interface EngineOption {
  id: string;
  isCorrect: boolean;
}

export interface EngineQuestion {
  id: string;
  options: readonly EngineOption[];
}

export interface BankQuestion {
  id: string;
  difficulty: Difficulty;
}

/** Đáp án học sinh chọn: questionId -> danh sách optionId. Câu không có khóa = bỏ trống. */
export type AnswerSheet = Readonly<Record<string, readonly string[]>>;

export interface AttemptScore {
  correct: number;
  total: number;
  /** Thang 10, làm tròn 2 chữ số thập phân. */
  score: number;
}

export interface DrawConfig {
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

export type DrawError =
  | { code: "invalid_config"; reason: "not_integer_or_negative" | "sum_mismatch" | "empty" }
  | { code: "insufficient_questions"; difficulty: Difficulty; have: number; need: number };

export type DrawResult<Q> =
  | { ok: true; questions: Q[] }
  | { ok: false; error: DrawError };

export interface AttemptShuffle {
  /** Thứ tự id câu hỏi của lần làm này. */
  questionOrder: string[];
  /** questionId -> thứ tự id đáp án hiển thị (vị trí 0 = A). */
  optionOrders: Record<string, string[]>;
}

export type ClassStatus = "assigned" | "dispatched" | "closed";

export type StartDeniedReason =
  | "not_dispatched"
  | "closed"
  | "max_attempts"
  | "already_completed"
  | "in_progress_elsewhere";

export interface StartAttemptInput {
  classStatus: ClassStatus;
  /** Số attempt đã tạo, tính cả interrupted và in_progress. */
  usedAttempts: number;
  maxAttempts: number;
  hasCompleted: boolean;
  hasInProgress: boolean;
}

export type StartAttemptDecision = { ok: true } | { ok: false; reason: StartDeniedReason };

/** Lỗi lập trình/dữ liệu đầu vào sai (không phải lỗi nghiệp vụ có dữ liệu như DrawError). */
export class EngineError extends Error {
  readonly code: "empty_exam" | "invalid_input";

  constructor(code: "empty_exam" | "invalid_input", message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}
