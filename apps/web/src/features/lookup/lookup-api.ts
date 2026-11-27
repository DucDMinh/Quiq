import type { LookupBody, LookupResult, LookupSchool, LookupYear } from "@quiq/shared/lookup";
import { api, ApiError, CLIENT_ERROR_CODES } from "@/lib/api-client";

// Trang công khai: 401 (không xảy ra ở đây) cũng không được bắn sự kiện chuyển sang đăng nhập cán bộ.
const PUBLIC_REQUEST = { skipUnauthenticatedEvent: true } as const;

export const lookupApi = {
  schools: () => api.get<LookupSchool[]>("/lookup/schools", PUBLIC_REQUEST),
  years: (schoolId: string) =>
    api.get<LookupYear[]>(`/lookup/schools/${encodeURIComponent(schoolId)}/years`, PUBLIC_REQUEST),
  lookup: (body: LookupBody) => api.post<LookupResult>("/lookup", body, PUBLIC_REQUEST),
};

/** Mọi lỗi về một ApiError để hiển thị thông điệp tiếng Việt. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(
    0,
    CLIENT_ERROR_CODES.NETWORK,
    "Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.",
  );
}

/** Số giây phải chờ khi bị giới hạn tốc độ (429), lấy từ `details.retryAfterSeconds` nếu có. */
export function retryAfterSeconds(error: ApiError): number | null {
  const details = error.details;
  if (typeof details !== "object" || details === null || !("retryAfterSeconds" in details)) return null;
  const seconds = details.retryAfterSeconds;
  return typeof seconds === "number" && seconds > 0 ? seconds : null;
}

const scoreFormat = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Điểm chính thức dạng vi-VN, luôn 2 chữ số thập phân (8,50; 0,00). */
export const formatScore = (score: number) => scoreFormat.format(score);

/** Bỏ dấu tiếng Việt và chữ hoa để tìm trường theo tên gõ không dấu. */
export function foldForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}
