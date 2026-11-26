import type { ErrorDefinition } from "../common/errors";

// Mã lỗi riêng của luồng học sinh vào thi và làm bài. Web rẽ nhánh theo `code`, hiển thị `message`.
export const STUDENT_ERRORS = {
  EXAM_NOT_FOUND: { status: 404, message: "Không tìm thấy bài thi." },
  // Cùng một thông điệp cho mã sai, mã vô hiệu, mã khác trường và học sinh không thuộc lớp được gán (FR-040, BR-014).
  STUDENT_NOT_ALLOWED: {
    status: 404,
    message: "Mã học sinh không đúng hoặc không thuộc lớp được gán.",
  },
  SCHOOL_LOCKED: { status: 403, message: "Trường đã bị khóa." },
  STUDENT_SESSION_REQUIRED: {
    status: 401,
    message: "Phiên làm bài đã kết thúc. Hãy nhập lại mã để vào thi.",
  },
  ENTER_CONFLICT: { status: 409, message: "Mã của bạn vừa được dùng để vào thi. Hãy thử lại." },
  EXAM_NOT_DISPATCHED: { status: 409, message: "Giáo viên chưa phát đề cho lớp của bạn." },
  EXAM_CLOSED: {
    status: 409,
    message: "Giáo viên đã đóng và thu bài. Bạn không thể bắt đầu lượt mới.",
  },
  ATTEMPT_ALREADY_COMPLETED: { status: 409, message: "Bạn đã hoàn thành bài này." },
  // Vào thi từ máy/trình duyệt khác trong lúc đang làm bài: chưa hỗ trợ đổi máy (FR-043 là tính năng sau).
  ATTEMPT_IN_PROGRESS: {
    status: 409,
    message: "Bạn đang làm bài này trên một máy khác. Hãy quay lại máy đó hoặc báo giáo viên.",
  },
  ATTEMPT_LIMIT_REACHED: { status: 409, message: "Bạn đã dùng hết lượt làm bài." },
  ATTEMPT_ENDED: { status: 409, message: "Lần làm bài này đã kết thúc." },
  ATTEMPT_NOT_FINISHED: { status: 409, message: "Bài làm chưa nộp nên chưa có kết quả." },
  INVALID_ANSWER: { status: 422, message: "Đáp án không thuộc câu hỏi này." },
} as const satisfies Record<string, ErrorDefinition>;

export type StudentErrorCode = keyof typeof STUDENT_ERRORS;
