import type { Clock } from "../../http/deps";

/** Số lượt tra cứu tối đa của một IP trong một cửa sổ; lượt kế tiếp bị từ chối 429. */
export const LOOKUP_MAX_REQUESTS = 30;
/** Cửa sổ cố định tính từ lượt đầu tiên; hết cửa sổ thì bộ đếm về 0. */
export const LOOKUP_WINDOW_MS = 60 * 1000;
/** Trần số khóa giữ trong bộ nhớ; vượt trần thì bỏ khóa cũ nhất. */
export const LOOKUP_LIMITER_MAX_KEYS = 10_000;

interface WindowEntry {
  count: number;
  windowStartMs: number;
}

export interface LookupRateLimiter {
  /**
   * Tính một lượt, ĐỒNG BỘ, trước mọi `await`: trả 0 nếu được tra, hoặc số giây còn bị chặn.
   * Mọi lượt đều tính (tra ra điểm hay không) vì kết quả hai trường hợp phải giống nhau; không có reset.
   */
  tryAcquire(key: string): number;
  /** Số khóa đang giữ (cho test kiểm việc dọn bộ nhớ). */
  size(): number;
}

/**
 * Bộ đếm in-memory theo IP (một tiến trình Koa), tạo mới mỗi lần đăng ký route.
 * Không khóa theo trường: ai cũng spam được id một trường, khóa theo trường sẽ chặn oan mọi học sinh của trường đó.
 */
export function createLookupRateLimiter(clock: Clock): LookupRateLimiter {
  // Map giữ thứ tự chèn: khóa đầu tiên có cửa sổ bắt đầu sớm nhất (khóa hết hạn bị xóa rồi mới chèn lại).
  const windows = new Map<string, WindowEntry>();
  let lastSweepMs = Number.NEGATIVE_INFINITY;
  const isExpired = (entry: WindowEntry, now: number) => now - entry.windowStartMs >= LOOKUP_WINDOW_MS;

  // Dọn theo đồng hồ của deps (không setInterval để không giữ tiến trình/test sống): tối đa một lần mỗi cửa sổ.
  function sweepExpired(now: number): void {
    if (now - lastSweepMs < LOOKUP_WINDOW_MS) return;
    lastSweepMs = now;
    for (const [key, entry] of windows) if (isExpired(entry, now)) windows.delete(key);
  }

  function evictOldestBeyondCap(): void {
    while (windows.size >= LOOKUP_LIMITER_MAX_KEYS) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) return;
      windows.delete(oldest);
    }
  }

  return {
    tryAcquire(key) {
      const now = clock.now().getTime();
      sweepExpired(now);
      const entry = windows.get(key);
      if (entry && !isExpired(entry, now)) {
        if (entry.count >= LOOKUP_MAX_REQUESTS) {
          return Math.max(1, Math.ceil((entry.windowStartMs + LOOKUP_WINDOW_MS - now) / 1000));
        }
        entry.count += 1;
        return 0;
      }
      windows.delete(key);
      evictOldestBeyondCap();
      windows.set(key, { count: 1, windowStartMs: now });
      return 0;
    },
    size: () => windows.size,
  };
}
