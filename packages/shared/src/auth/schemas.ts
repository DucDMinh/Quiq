import { z } from "zod";

// Khớp STAFF_ROLES của @quiq/db (gói shared không phụ thuộc db); auth.test.ts của api kiểm hai danh sách bằng nhau.
export const STAFF_ROLES = ["super_admin", "school_admin", "teacher"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Phiên cán bộ hết hạn trượt: mỗi request hợp lệ đẩy hạn thêm đúng khoảng này. */
export const STAFF_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Giới hạn độ dài để chuỗi khổng lồ không tới được scrypt. Thông báo lỗi của zod không chứa giá trị nhập.
export const loginRequestSchema = z.object({
  username: z.string().trim().min(1, "Nhập tên đăng nhập").max(100, "Tên đăng nhập quá dài"),
  password: z.string().min(1, "Nhập mật khẩu").max(200, "Mật khẩu quá dài"),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Người dùng của phiên hiện tại, trả bởi `POST /api/auth/login` và `GET /api/auth/me`. */
export const staffMeSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  role: z.enum(STAFF_ROLES),
  /** null với admin tổng (không thuộc trường nào). */
  schoolId: z.string().nullable(),
  schoolName: z.string().nullable(),
  /** Môn cố định, chỉ giáo viên có. */
  subject: z.object({ id: z.string(), name: z.string() }).nullable(),
});

export type StaffMe = z.infer<typeof staffMeSchema>;
