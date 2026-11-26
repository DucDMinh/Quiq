import type {
  AttemptResultView,
  EnterBody,
  ExamPaperView,
  SaveAnswerBody,
  SaveAnswerResult,
  StudentStateView,
} from "@quiq/shared/student";
import { api, ApiError, CLIENT_ERROR_CODES } from "@/lib/api-client";

// 401 của học sinh KHÔNG được bắn sự kiện chuyển sang trang đăng nhập cán bộ.
const STUDENT_REQUEST = { skipUnauthenticatedEvent: true } as const;

export const studentApi = {
  enter: (body: EnterBody) =>
    api.post<{ examCode: string }>("/student/enter", body, STUDENT_REQUEST),
  state: () => api.get<StudentStateView>("/student/state", STUDENT_REQUEST),
  start: () => api.post<ExamPaperView>("/student/attempts", undefined, STUDENT_REQUEST),
  paper: (attemptId: string) =>
    api.get<ExamPaperView>(`/student/attempts/${attemptId}`, STUDENT_REQUEST),
  saveAnswer: (attemptId: string, body: SaveAnswerBody) =>
    api.put<SaveAnswerResult>(`/student/attempts/${attemptId}/answers`, body, STUDENT_REQUEST),
  submit: (attemptId: string) =>
    api.post<AttemptResultView>(
      `/student/attempts/${attemptId}/submit`,
      undefined,
      STUDENT_REQUEST,
    ),
  result: (attemptId: string) =>
    api.get<AttemptResultView>(`/student/attempts/${attemptId}/result`, STUDENT_REQUEST),
};

export type ExamStep = "phong-cho" | "lam-bai" | "ket-qua";

export function examPath(examCode: string, step?: ExamStep): string {
  const base = `/thi/${encodeURIComponent(examCode)}`;
  return step ? `${base}/${step}` : base;
}

/** Mọi lỗi về một ApiError để hiển thị thông điệp tiếng Việt. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(
    0,
    CLIENT_ERROR_CODES.NETWORK,
    "Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.",
  );
}

/** Phiên học sinh đã hết (hoặc chưa vào thi): phải nhập lại mã. */
export const isSessionError = (error: ApiError) => error.code === "STUDENT_SESSION_REQUIRED";
