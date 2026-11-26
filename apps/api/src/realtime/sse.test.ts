import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { MAX_BUFFERED_BYTES, createSseWriter } from "./sse";

describe("createSseWriter (backpressure)", () => {
  it("client không đọc: đệm vượt ngưỡng thì gọi onOverflow đúng một lần và không ghi thêm", () => {
    // highWaterMark nhỏ để đệm phía ghi tăng ngay khi không ai đọc (như socket nghẽn phía sau pipe).
    const stream = new PassThrough({ highWaterMark: 16 });
    const onOverflow = vi.fn();
    const write = createSseWriter(stream, onOverflow, 100);
    for (let i = 0; i < 10; i += 1) write("x".repeat(50));
    expect(onOverflow).toHaveBeenCalledTimes(1);
    const buffered = stream.writableLength;
    expect(buffered).toBeGreaterThan(100);

    write("x".repeat(50));
    expect(stream.writableLength).toBe(buffered);
    expect(onOverflow).toHaveBeenCalledTimes(1);
  });

  it("luồng đã kết thúc: bỏ qua lần ghi, không lỗi; ngưỡng mặc định 1 MB", () => {
    const stream = new PassThrough();
    const onOverflow = vi.fn();
    const write = createSseWriter(stream, onOverflow);
    stream.end();
    expect(() => write("data: muộn\n\n")).not.toThrow();
    expect(onOverflow).not.toHaveBeenCalled();
    expect(MAX_BUFFERED_BYTES).toBe(1024 * 1024);
  });
});
