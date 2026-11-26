import { STUDENT_ERRORS, type StudentErrorCode } from "@quiq/shared/student";
import { AppError } from "../../http/errors";

export function studentError(code: StudentErrorCode): AppError {
  return new AppError(code, STUDENT_ERRORS[code]);
}

const UNIQUE_VIOLATION = "23505";

/**
 * Drizzle bọc lỗi của driver trong `cause`, nên dò cả chuỗi để nhận ra vi phạm ràng buộc duy nhất
 * (vd. hai request Bắt đầu cùng lúc đụng chỉ mục `attempts_one_in_progress_key`).
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 4; depth++) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    current = current.cause;
  }
  return false;
}
