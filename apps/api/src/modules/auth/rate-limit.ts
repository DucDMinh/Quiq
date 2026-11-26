import type { Clock } from "../../http/deps";

/** Tối đa số lượt thử chưa thành công trong một cửa sổ; lượt kế tiếp (thứ 6) bị từ chối 429. */
export const LOGIN_MAX_FAILURES = 5;
/** Cửa sổ tính từ lượt thử đầu tiên; hết cửa sổ thì bộ đếm về 0. */
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
/** Trần số khóa giữ trong bộ nhớ; vượt trần thì bỏ khóa cũ nhất để bộ nhớ không phình khi bị dò hàng loạt tên. */
export const LOGIN_LIMITER_MAX_KEYS = 10_000;

interface AttemptEntry {
  count: number;
  windowStartMs: number;
}

export interface LoginRateLimiter {
  /**
   * Giữ chỗ một lượt thử, ĐỒNG BỘ, trước khi kiểm mật khẩu: trả 0 nếu được thử (đã tính lượt),
   * hoặc số giây còn bị chặn. Nhờ tính trước khi `await`, các request song song không cùng lọt qua giới hạn.
   */
  tryAcquire(key: string): number;
  /** Đăng nhập đúng: xóa bộ đếm (kể cả lượt vừa giữ chỗ). */
  reset(key: string): void;
  /** Số khóa đang giữ (cho test kiểm việc dọn bộ nhớ). */
  size(): number;
}

/** Khóa theo IP + tên đăng nhập (chữ thường, bỏ khoảng trắng) vì tên đăng nhập duy nhất không phân biệt hoa thường. */
export function loginRateLimitKey(ip: string, username: string): string {
  return `${ip}\u0000${username.trim().toLowerCase()}`;
}

/** Bộ đếm in-memory (một tiến trình Koa). Tạo mới mỗi lần đăng ký route để test không dùng chung trạng thái. */
export function createLoginRateLimiter(clock: Clock): LoginRateLimiter {
  // Map giữ thứ tự chèn: khóa đầu tiên là khóa có cửa sổ bắt đầu sớm nhất (khóa hết hạn bị xóa rồi mới chèn lại).
  const attempts = new Map<string, AttemptEntry>();
  let lastSweepMs = Number.NEGATIVE_INFINITY;
  const isExpired = (entry: AttemptEntry, now: number) => now - entry.windowStartMs >= LOGIN_FAILURE_WINDOW_MS;

  // Dọn theo đồng hồ của deps (không dùng setInterval nên không giữ tiến trình/test sống): tối đa một lần mỗi cửa sổ.
  function sweepExpired(now: number): void {
    if (now - lastSweepMs < LOGIN_FAILURE_WINDOW_MS) return;
    lastSweepMs = now;
    for (const [key, entry] of attempts) if (isExpired(entry, now)) attempts.delete(key);
  }

  function evictOldestBeyondCap(): void {
    while (attempts.size >= LOGIN_LIMITER_MAX_KEYS) {
      const oldest = attempts.keys().next().value;
      if (oldest === undefined) return;
      attempts.delete(oldest);
    }
  }

  return {
    tryAcquire(key) {
      const now = clock.now().getTime();
      sweepExpired(now);
      const entry = attempts.get(key);
      if (entry && !isExpired(entry, now)) {
        if (entry.count >= LOGIN_MAX_FAILURES) {
          return Math.max(1, Math.ceil((entry.windowStartMs + LOGIN_FAILURE_WINDOW_MS - now) / 1000));
        }
        entry.count += 1;
        return 0;
      }
      attempts.delete(key);
      evictOldestBeyondCap();
      attempts.set(key, { count: 1, windowStartMs: now });
      return 0;
    },
    reset(key) {
      attempts.delete(key);
    },
    size: () => attempts.size,
  };
}
