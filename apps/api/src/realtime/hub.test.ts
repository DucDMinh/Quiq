import { describe, expect, it, vi } from "vitest";
import { DEFAULT_REALTIME_TIMING, createRealtimeHub } from "./hub";

describe("RealtimeHub", () => {
  it("chỉ báo người nghe của đúng lớp; huỷ đăng ký (kể cả hai lần) gỡ hẳn lớp khỏi hub", () => {
    const hub = createRealtimeHub();
    const classA = vi.fn();
    const classB = vi.fn();
    const offA = hub.subscribe("A", classA);
    hub.subscribe("B", classB);

    hub.publish("A");
    expect(classA).toHaveBeenCalledTimes(1);
    expect(classB).not.toHaveBeenCalled();
    expect(hub.listenerCount("A")).toBe(1);
    expect(hub.listenerCount()).toBe(2);

    offA();
    offA();
    hub.publish("A");
    expect(classA).toHaveBeenCalledTimes(1);
    expect(hub.listenerCount("A")).toBe(0);
    expect(hub.listenerCount()).toBe(1);
  });

  it("người nghe ném lỗi không chặn người khác, publish không ném ra ngoài", () => {
    const hub = createRealtimeHub();
    const healthy = vi.fn();
    hub.subscribe("A", () => {
      throw new Error("hỏng");
    });
    hub.subscribe("A", healthy);
    expect(() => hub.publish("A")).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it("publish lớp không ai nghe là vô hại; nhịp mặc định 250ms/10s, ghi đè được từng phần", () => {
    expect(() => createRealtimeHub().publish("không-ai")).not.toThrow();
    expect(createRealtimeHub().timing).toEqual(DEFAULT_REALTIME_TIMING);
    expect(DEFAULT_REALTIME_TIMING).toEqual({ coalesceMs: 250, refreshMs: 10_000 });
    expect(createRealtimeHub({ refreshMs: 50 }).timing).toEqual({ coalesceMs: 250, refreshMs: 50 });
  });
});
