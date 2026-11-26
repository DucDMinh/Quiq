import { apiFailureSchema } from "@quiq/shared/common";

/** Sự kiện trên `window` khi API trả 401; shell lắng nghe để điều hướng sang trang đăng nhập. */
export const UNAUTHENTICATED_EVENT = "quiq:unauthenticated";

export interface UnauthenticatedEventDetail {
  code: string;
  message: string;
}

/** Mã dùng khi không có envelope từ API (mất mạng, phản hồi không phải JSON chuẩn). */
export const CLIENT_ERROR_CODES = {
  NETWORK: "NETWORK_ERROR",
  BAD_RESPONSE: "BAD_RESPONSE",
} as const;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface RequestOptions {
  /** Đối tượng thường sẽ gửi JSON; FormData gửi nguyên (tải tệp). */
  body?: unknown;
  /** Tham số truy vấn; giá trị undefined/null bị bỏ qua. */
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** Đặt true cho request mà 401 là kết quả hợp lệ (ví dụ đăng nhập sai mật khẩu). */
  skipUnauthenticatedEvent?: boolean;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const API_PREFIX = "/api";

// Nhận "/exams", "exams", "/api/exams" và "/api": tiền tố /api chỉ được thêm khi chưa có.
function withApiPrefix(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const hasPrefix = normalized === API_PREFIX || normalized.startsWith(`${API_PREFIX}/`);
  return hasPrefix ? normalized : `${API_PREFIX}${normalized}`;
}

// Luôn gọi cùng origin để cookie HttpOnly đi theo rewrite của Next.
function buildUrl(path: string, query: RequestOptions["query"]): string {
  const base = withApiPrefix(path);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `${base}?${queryString}` : base;
}

function buildInit(method: Method, options: RequestOptions): RequestInit {
  const init: RequestInit = { method, credentials: "include", signal: options.signal };
  if (options.body === undefined) return init;
  if (options.body instanceof FormData) {
    init.body = options.body;
  } else {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }
  return init;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Kiểm theo tên vì DOMException của jsdom/Node/trình duyệt là các lớp khác nhau.
function isAbortError(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && "name" in cause && cause.name === "AbortError";
}

function notifyUnauthenticated(error: ApiError): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<UnauthenticatedEventDetail>(UNAUTHENTICATED_EVENT, {
      detail: { code: error.code, message: error.message },
    }),
  );
}

function toApiError(response: Response, body: unknown): ApiError {
  const failure = apiFailureSchema.safeParse(body);
  if (failure.success) {
    return new ApiError(response.status, failure.data.code, failure.data.error, failure.data.details);
  }
  return new ApiError(
    response.status,
    CLIENT_ERROR_CODES.BAD_RESPONSE,
    "Máy chủ trả về phản hồi không hợp lệ.",
  );
}

/** Gọi API, trả `data` của envelope thành công; mọi lỗi (mạng, envelope lỗi, HTTP lỗi) ném `ApiError`. */
export async function apiRequest<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), buildInit(method, options));
  } catch (cause) {
    if (isAbortError(cause)) throw cause;
    throw new ApiError(0, CLIENT_ERROR_CODES.NETWORK, "Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.");
  }

  const body = await readJson(response);

  if (!response.ok) {
    const error = toApiError(response, body);
    if (response.status === 401 && !options.skipUnauthenticatedEvent) notifyUnauthenticated(error);
    throw error;
  }

  if (response.status === 204) return undefined as T;
  if (typeof body === "object" && body !== null && "success" in body && body.success === true && "data" in body) {
    return body.data as T;
  }
  throw toApiError(response, body);
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body">) => apiRequest<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    apiRequest<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    apiRequest<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    apiRequest<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "body">) => apiRequest<T>("DELETE", path, options),
};
