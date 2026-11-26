import { describe, expect, it } from "vitest";
import { canStartAttempt, computeEndsAt, isExpired, remainingSeconds } from "./attempt-state";
import { EngineError, type StartAttemptInput } from "./types";

const base: StartAttemptInput = {
  classStatus: "dispatched",
  usedAttempts: 0,
  maxAttempts: 3,
  hasCompleted: false,
  hasInProgress: false,
};

describe("computeEndsAt", () => {
  it("cộng đúng số phút, không đổi startedAt", () => {
    const startedAt = new Date("2026-01-01T08:00:00.000Z");
    const endsAt = computeEndsAt(startedAt, 45);
    expect(endsAt.toISOString()).toBe("2026-01-01T08:45:00.000Z");
    expect(startedAt.toISOString()).toBe("2026-01-01T08:00:00.000Z");
  });
  it("số phút không hợp lệ ném lỗi", () => {
    const t = new Date(0);
    expect(() => computeEndsAt(t, 0)).toThrow(EngineError);
    expect(() => computeEndsAt(t, -5)).toThrow(EngineError);
    expect(() => computeEndsAt(t, Number.NaN)).toThrow(EngineError);
  });
});

describe("remainingSeconds", () => {
  const endsAt = new Date("2026-01-01T09:00:00.000Z");
  it("còn 60 giây", () => {
    expect(remainingSeconds(endsAt, new Date("2026-01-01T08:59:00.000Z"))).toBe(60);
  });
  it("làm tròn lên: còn 0.5s hiển thị 1", () => {
    expect(remainingSeconds(endsAt, new Date("2026-01-01T08:59:59.500Z"))).toBe(1);
  });
  it("đúng lúc hết giờ và sau đó = 0, không âm", () => {
    expect(remainingSeconds(endsAt, endsAt)).toBe(0);
    expect(remainingSeconds(endsAt, new Date("2026-01-01T09:10:00.000Z"))).toBe(0);
  });
});

describe("isExpired", () => {
  const endsAt = new Date("2026-01-01T09:00:00.000Z");
  const at = (ms: number) => new Date(endsAt.getTime() + ms);

  it("trước ends_at: chưa hết hạn", () => {
    expect(isExpired(endsAt, at(-1))).toBe(false);
  });
  it("đúng ends_at: còn trong thời gian ân hạn", () => {
    expect(isExpired(endsAt, at(0))).toBe(false);
  });
  it("đúng ends_at + 3s: vẫn chấp nhận", () => {
    expect(isExpired(endsAt, at(3000))).toBe(false);
  });
  it("ends_at + 3s + 1ms: hết hạn", () => {
    expect(isExpired(endsAt, at(3001))).toBe(true);
  });
  it("graceSeconds tùy chỉnh, kể cả 0", () => {
    expect(isExpired(endsAt, at(0), 0)).toBe(false);
    expect(isExpired(endsAt, at(1), 0)).toBe(true);
    expect(isExpired(endsAt, at(10_000), 10)).toBe(false);
    expect(isExpired(endsAt, at(10_001), 10)).toBe(true);
  });
  it("graceSeconds âm ném lỗi", () => {
    expect(() => isExpired(endsAt, at(0), -1)).toThrow(EngineError);
  });
});

describe("canStartAttempt", () => {
  it("hợp lệ", () => {
    expect(canStartAttempt(base)).toEqual({ ok: true });
  });
  it("not_dispatched", () => {
    expect(canStartAttempt({ ...base, classStatus: "assigned" })).toEqual({ ok: false, reason: "not_dispatched" });
  });
  it("closed", () => {
    expect(canStartAttempt({ ...base, classStatus: "closed" })).toEqual({ ok: false, reason: "closed" });
  });
  it("already_completed", () => {
    expect(canStartAttempt({ ...base, hasCompleted: true, usedAttempts: 1 })).toEqual({
      ok: false,
      reason: "already_completed",
    });
  });
  it("in_progress_elsewhere", () => {
    expect(canStartAttempt({ ...base, hasInProgress: true, usedAttempts: 1 })).toEqual({
      ok: false,
      reason: "in_progress_elsewhere",
    });
  });
  it("max_attempts: demo maxAttempts=1", () => {
    expect(canStartAttempt({ ...base, maxAttempts: 1, usedAttempts: 1 })).toEqual({ ok: false, reason: "max_attempts" });
    expect(canStartAttempt({ ...base, maxAttempts: 1, usedAttempts: 0 })).toEqual({ ok: true });
  });
  it("max_attempts: giá trị bất kỳ, biên used = max-1 còn được làm", () => {
    expect(canStartAttempt({ ...base, maxAttempts: 5, usedAttempts: 4 })).toEqual({ ok: true });
    expect(canStartAttempt({ ...base, maxAttempts: 5, usedAttempts: 5 })).toEqual({ ok: false, reason: "max_attempts" });
    expect(canStartAttempt({ ...base, maxAttempts: 5, usedAttempts: 6 })).toEqual({ ok: false, reason: "max_attempts" });
  });
  it("đầu vào không hợp lệ ném invalid_input thay vì fail-open", () => {
    const bad = (patch: Record<string, unknown>) => () =>
      canStartAttempt({ ...base, ...patch } as unknown as StartAttemptInput);
    expect(bad({ maxAttempts: Number.NaN })).toThrow(EngineError);
    expect(bad({ maxAttempts: undefined })).toThrow(EngineError);
    expect(bad({ maxAttempts: -1 })).toThrow(EngineError);
    expect(bad({ maxAttempts: 1.5 })).toThrow(EngineError);
    expect(bad({ usedAttempts: Number.NaN })).toThrow(EngineError);
    expect(bad({ usedAttempts: undefined })).toThrow(EngineError);
    expect(bad({ usedAttempts: -1 })).toThrow(EngineError);
    expect(bad({ usedAttempts: 0.5 })).toThrow(EngineError);
  });
  it("ưu tiên lý do: lớp trước, rồi đã hoàn thành, rồi đang làm dở, cuối cùng hết lượt", () => {
    const all = { ...base, usedAttempts: 3, hasCompleted: true, hasInProgress: true };
    expect(canStartAttempt({ ...all, classStatus: "assigned" })).toEqual({ ok: false, reason: "not_dispatched" });
    expect(canStartAttempt({ ...all, classStatus: "closed" })).toEqual({ ok: false, reason: "closed" });
    expect(canStartAttempt(all)).toEqual({ ok: false, reason: "already_completed" });
    expect(canStartAttempt({ ...all, hasCompleted: false })).toEqual({ ok: false, reason: "in_progress_elsewhere" });
    expect(canStartAttempt({ ...all, hasCompleted: false, hasInProgress: false })).toEqual({
      ok: false,
      reason: "max_attempts",
    });
  });
});
