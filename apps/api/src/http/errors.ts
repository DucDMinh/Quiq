import { COMMON_ERRORS } from "@quiq/shared/common";
import type { CommonErrorCode, ErrorDefinition } from "@quiq/shared/common";

interface ErrorOptions {
  details?: unknown;
}

/**
 * Lỗi nghiệp vụ có chủ đích; errorMiddleware biến nó thành envelope lỗi.
 * Mã chung (COMMON_ERRORS) lấy status/thông báo từ danh mục; mã riêng của domain phải tự khai status + message.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: CommonErrorCode, options?: ErrorOptions & { message?: string });
  constructor(code: string, options: ErrorOptions & ErrorDefinition);
  constructor(code: string, options: ErrorOptions & Partial<ErrorDefinition> = {}) {
    const known = (COMMON_ERRORS as Record<string, ErrorDefinition | undefined>)[code];
    const fallback = known ?? COMMON_ERRORS.INTERNAL;
    super(options.message ?? fallback.message);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? fallback.status;
    this.details = options.details;
  }
}
