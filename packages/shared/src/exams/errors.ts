import type { ErrorDefinition } from "../common/errors";

// Mã lỗi riêng của ra đề và điều khiển lớp (giáo viên). Web rẽ nhánh theo `code`, hiển thị `message`.
export const EXAM_ERRORS = {
  // Thông điệp thật nêu mức thiếu (vd "Ngân hàng chỉ có 8 câu Khó, cần 10."), kèm details {difficulty, have, need}.
  INSUFFICIENT_QUESTIONS: { status: 422, message: "Ngân hàng câu hỏi không đủ câu để rút đề." },
  INVALID_DRAW_CONFIG: {
    status: 422,
    message: "Tổng số câu phải lớn hơn 0 và bằng số câu Dễ + Trung bình + Khó.",
  },
  CLASS_NOT_ASSIGNED: {
    status: 403,
    message: "Bạn chỉ được gán bài thi cho lớp mình phụ trách trong năm học hiện tại.",
  },
  EXAM_HAS_ATTEMPTS: { status: 409, message: "Bài thi đã có học sinh làm nên không xóa được." },
  CLASS_ALREADY_DISPATCHED: { status: 409, message: "Lớp này đã được phát đề." },
  CLASS_NOT_DISPATCHED: { status: 409, message: "Lớp chưa được phát đề nên chưa thể thu bài." },
  CLASS_ALREADY_CLOSED: { status: 409, message: "Lớp này đã thu bài." },
} as const satisfies Record<string, ErrorDefinition>;

export type ExamErrorCode = keyof typeof EXAM_ERRORS;
