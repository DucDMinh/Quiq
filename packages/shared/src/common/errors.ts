export interface ErrorDefinition {
  readonly status: number;
  readonly message: string;
}

// Danh mục lỗi dùng chung hai phía. Mỗi domain (auth, exams, ...) khai thêm mã của riêng mình
// trong packages/shared/src/<domain>/errors.ts theo cùng hình dạng ErrorDefinition.
export const COMMON_ERRORS = {
  BAD_REQUEST: { status: 400, message: "Yêu cầu không hợp lệ." },
  UNAUTHENTICATED: { status: 401, message: "Bạn cần đăng nhập để tiếp tục." },
  FORBIDDEN: { status: 403, message: "Bạn không có quyền thực hiện thao tác này." },
  NOT_FOUND: { status: 404, message: "Không tìm thấy nội dung yêu cầu." },
  CONFLICT: { status: 409, message: "Dữ liệu bị trùng hoặc xung đột với dữ liệu hiện có." },
  PAYLOAD_TOO_LARGE: { status: 413, message: "Dữ liệu gửi lên quá lớn." },
  VALIDATION: { status: 422, message: "Dữ liệu không hợp lệ." },
  RATE_LIMITED: { status: 429, message: "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút." },
  INTERNAL: { status: 500, message: "Đã có lỗi xảy ra, vui lòng thử lại sau." },
} as const satisfies Record<string, ErrorDefinition>;

export type CommonErrorCode = keyof typeof COMMON_ERRORS;
