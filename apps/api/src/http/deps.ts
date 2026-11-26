/**
 * Phụ thuộc ngoài mà mọi module nhận qua tham số thứ hai của `routes.ts`: `(router, deps) => void`.
 * Chỉ một object phẳng truyền xuống, không có DI container.
 *
 * QUY ƯỚC ĐỒNG HỒ: code nghiệp vụ (hết giờ, đẩy máy, gián đoạn, hạn phiên...) luôn lấy thời gian
 * từ `deps.clock.now()`, KHÔNG gọi `new Date()` / `Date.now()` trực tiếp. Nhờ vậy test dùng đồng hồ giả
 * (`createTestClock` trong testing/test-clock.ts) để tua thời gian thay vì chờ thật.
 */
import type { DatabaseLike } from "@quiq/db";

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Cấu hình phiên cán bộ (cookie `quiq_session`). */
export interface SessionConfig {
  /** Khóa HMAC băm token phiên trước khi lưu DB (từ SESSION_SECRET). */
  secret: string;
  /** Gắn cờ `Secure` cho cookie (production, TLS kết thúc ở proxy phía trước). */
  secureCookie: boolean;
}

export interface AppDeps {
  /** postgres-js ở staging/prod, PGlite ở test; cùng một kiểu `DatabaseLike`. */
  db: DatabaseLike;
  clock: Clock;
  /**
   * Tùy chọn để `createApp({ deps: { db, clock } })` cũ vẫn chạy cho module không cần phiên.
   * Thiếu thì mọi route cần phiên cán bộ trả 500 (đóng chặt), không bao giờ dùng khóa mặc định.
   * server.ts luôn truyền; createTestApp truyền khóa test.
   */
  session?: SessionConfig;
}
