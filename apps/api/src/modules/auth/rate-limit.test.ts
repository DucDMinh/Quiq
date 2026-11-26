import { describe, expect, it } from "vitest";
import { createTestClock } from "../../testing/test-clock";
import {
  createLoginRateLimiter,
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_LIMITER_MAX_KEYS,
  LOGIN_MAX_FAILURES,
  loginRateLimitKey,
} from "./rate-limit";

describe("createLoginRateLimiter", () => {
  it("giữ chỗ đủ 5 lượt rồi chặn, báo số giây còn lại; reset xóa bộ đếm", () => {
    const clock = createTestClock();
    const limiter = createLoginRateLimiter(clock);
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) expect(limiter.tryAcquire("k")).toBe(0);
    expect(limiter.tryAcquire("k")).toBe(LOGIN_FAILURE_WINDOW_MS / 1000);

    clock.advance(60_000);
    expect(limiter.tryAcquire("k")).toBe(LOGIN_FAILURE_WINDOW_MS / 1000 - 60);

    limiter.reset("k");
    expect(limiter.tryAcquire("k")).toBe(0);
  });

  it("hết cửa sổ thì được thử lại", () => {
    const clock = createTestClock();
    const limiter = createLoginRateLimiter(clock);
    for (let i = 0; i <= LOGIN_MAX_FAILURES; i++) limiter.tryAcquire("k");
    clock.advance(LOGIN_FAILURE_WINDOW_MS);
    expect(limiter.tryAcquire("k")).toBe(0);
  });

  it("khóa hết cửa sổ được dọn khỏi bộ nhớ theo đồng hồ, không cần chạm lại đúng khóa đó", () => {
    const clock = createTestClock();
    const limiter = createLoginRateLimiter(clock);
    for (let i = 0; i < 50; i++) limiter.tryAcquire(`ten-${i}`);
    expect(limiter.size()).toBe(50);

    clock.advance(LOGIN_FAILURE_WINDOW_MS);
    limiter.tryAcquire("khac");
    expect(limiter.size()).toBe(1);
  });

  it("số khóa không vượt trần: bỏ khóa cũ nhất", () => {
    const clock = createTestClock();
    const limiter = createLoginRateLimiter(clock);
    for (let i = 0; i < LOGIN_LIMITER_MAX_KEYS + 25; i++) limiter.tryAcquire(`ten-${i}`);
    expect(limiter.size()).toBe(LOGIN_LIMITER_MAX_KEYS);
  });

  it("khóa không phân biệt hoa thường và khoảng trắng của tên đăng nhập", () => {
    expect(loginRateLimitKey("1.2.3.4", "  GV.Toan ")).toBe(loginRateLimitKey("1.2.3.4", "gv.toan"));
    expect(loginRateLimitKey("1.2.3.4", "gv.toan")).not.toBe(loginRateLimitKey("5.6.7.8", "gv.toan"));
  });
});
