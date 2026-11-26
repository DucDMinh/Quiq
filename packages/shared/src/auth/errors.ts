import type { ErrorDefinition } from "../common/errors";

// Mã lỗi riêng của đăng nhập/phiên cán bộ. Thiếu hoặc hết phiên dùng mã chung UNAUTHENTICATED.
export const AUTH_ERRORS = {
  // Cùng một thông điệp cho sai tên đăng nhập, sai mật khẩu và tài khoản bị vô hiệu: không lộ ô nào sai.
  INVALID_CREDENTIALS: { status: 401, message: "Tên đăng nhập hoặc mật khẩu không đúng." },
  SCHOOL_LOCKED: { status: 403, message: "Trường của bạn đang bị khóa. Liên hệ quản trị hệ thống." },
  LOGIN_THROTTLED: {
    status: 429,
    message: "Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.",
  },
} as const satisfies Record<string, ErrorDefinition>;

export type AuthErrorCode = keyof typeof AUTH_ERRORS;
