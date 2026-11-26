import type { Clock } from "../http/deps";

export interface TestClock extends Clock {
  set(date: Date): void;
  advance(ms: number): void;
}

/** Đồng hồ giả cho test: đứng yên cho tới khi test `set`/`advance`. */
export function createTestClock(start: Date = new Date("2026-01-01T00:00:00.000Z")): TestClock {
  let currentMs = start.getTime();
  return {
    // Trả Date mới mỗi lần để code gọi `setX` lên kết quả không làm lệch đồng hồ.
    now: () => new Date(currentMs),
    set: (date) => {
      currentMs = date.getTime();
    },
    advance: (ms) => {
      currentMs += ms;
    },
  };
}
