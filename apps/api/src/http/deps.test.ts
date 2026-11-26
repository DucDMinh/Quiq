import { describe, expect, it } from "vitest";
import { systemClock } from "./deps";

describe("systemClock", () => {
  it("trả thời điểm hiện tại mỗi lần gọi (Date mới, không đóng băng)", () => {
    const before = Date.now();
    const first = systemClock.now();
    const after = Date.now();

    expect(first).toBeInstanceOf(Date);
    expect(first.getTime()).toBeGreaterThanOrEqual(before);
    expect(first.getTime()).toBeLessThanOrEqual(after);
    expect(systemClock.now()).not.toBe(first);
  });
});
